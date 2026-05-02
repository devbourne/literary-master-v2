# Literary Master 동작 플로우 완성도 평가

작성일: 2026-04-21  
분석 범위: 입력 UI, URL/작품집 스캔, `/api/analyze` SSE, LLM 오케스트레이터, Verify Agent, 저장, PDF 내보내기  
검증 기준: 실제 코드 흐름, README의 의도된 파이프라인, Next.js 16 로컬 문서의 Route Handler 규칙

## 결론

이 프로젝트는 이름과 README에서는 “에이전틱 문학 분석 플랫폼”이라고 설명하지만, 실제 핵심 구조는 **고정 순서 LLM 분석 파이프라인**이다. 에이전틱 요소는 `Verify` 단계에 한정되어 있으며, 그마저도 계획 수립, 도구 선택, 재작성 반영까지 수행하는 자율 에이전트가 아니라 **결말 문맥을 넓혀 재검증하는 제한적 반복 루프**에 가깝다.

완성도 평가는 **7.1 / 10**이다.

- 기본 사용자 플로우는 끝까지 연결되어 있다: 입력 → 스캔 → 분석 SSE → 저장 → 조회 → 렌더링 → PDF.
- 파이프라인 단계의 책임 분리는 비교적 명확하다.
- LLM JSON 실패를 흡수하는 복구 장치와 커버리지 경고가 있어 실사용 회복력은 있다.
- 다만 “출판 수준 교재 자동 생성”으로 보기에는 장문 처리, 누락 블록 복구, 검증 결과 반영, 중단 처리, 스트리밍/Markdown 일관성이 부족하다.

## 실제 동작 플로우

### 1. 입력 및 작품 선택

사용자는 `AnalysisPage`에서 텍스트 또는 URL 기반 텍스트를 넘긴다. 입력 텍스트는 먼저 `/api/scan`으로 앞부분 샘플만 보내 작품집인지 단일 작품인지 판정한다.

- UI는 텍스트 앞 4,000자를 샘플로 보낸다: `src/components/analysis-page.tsx:61-68`
- `/api/scan`은 LLM으로 `single` 또는 `collection`을 판정한다: `src/app/api/scan/route.ts:13-35`
- 여러 작품이면 클라이언트가 제목 문자열 위치를 찾아 작품 구간을 잘라낸다: `src/components/analysis-page.tsx:34-53`, `src/components/analysis-page.tsx:86-105`
- 단일 작품이면 바로 분석을 시작한다: `src/components/analysis-page.tsx:71-78`

평가: 입력 플로우는 단순하고 빠르지만, 작품집 분리는 제목 문자열 매칭에 크게 의존한다. 목차, 중복 제목, 대소문자 차이, 장 제목이 본문에 반복되는 경우 오분할 가능성이 있다.

### 2. 분석 API 및 SSE

분석은 `/api/analyze`의 `POST` Route Handler에서 시작된다. Next.js 16 로컬 문서 기준으로 `route.ts`는 Web `Request`/`Response` API를 사용하며, 현재 구현은 이 규칙을 따른다.

- 입력 길이 제한 기본값은 200,000자다: `src/app/api/analyze/route.ts:6-9`
- 동시 분석 제한은 프로세스 전역 카운터로 기본 2개다: `src/app/api/analyze/route.ts:10-16`, `src/app/api/analyze/route.ts:62-72`
- `ReadableStream`으로 SSE 이벤트를 전송한다: `src/app/api/analyze/route.ts:75-106`
- 클라이언트는 `data: ...` 라인을 읽어 reducer에 반영한다: `src/hooks/use-analysis.ts:165-285`

평가: SSE 연결과 상태 전이는 정상적인 구조다. 단, 클라이언트가 취소해도 서버 오케스트레이션을 실제로 중단하는 `cancel()` 경로가 없어 LLM 호출은 계속 진행될 수 있다. 이는 긴 분석에서 자원 점유와 동시성 카운터 고갈로 이어질 수 있다.

### 3. Pass 1: Profile

오케스트레이터는 전체 텍스트를 한 번에 프로파일 프롬프트에 넣고 LLM을 호출한다.

- `orchestrate()` 시작: `src/lib/pipeline/orchestrator.ts:63-80`
- 전체 텍스트 기반 profile LLM 호출: `src/lib/pipeline/orchestrator.ts:83-88`
- Zod 스키마와 `safeParseLLM`으로 복구 파싱: `src/lib/pipeline/orchestrator.ts:86-90`

평가: 작품 전체의 주제, 인물, 반전, 복선 정보를 먼저 잡고 이후 배치 분석에 전달하는 설계는 타당하다. 하지만 입력 제한은 문자 기준 200,000자인 반면 Ollama context 기본은 32,768 토큰이다. 장문 원문은 Pass 1에서 컨텍스트 초과, 앞/뒤 손실, 모델 내부 절단 가능성이 높다. 이 단계가 실패하면 이후 모든 블록 해석의 기준점도 흔들린다.

### 4. Pass 2: Block Batches

원문은 단락/문장 단위 블록으로 나뉘고, 5개씩 순차 분석된다.

- 블록 분할은 빈 줄, 줄바꿈, 문장 단위 fallback 순서로 수행된다: `src/lib/pipeline/blocker.ts:6-49`
- 5개씩 배치한다: `src/lib/pipeline/orchestrator.ts:101-117`
- 각 배치에 profile 요약, rolling summary, 직전 번역을 넣는다: `src/lib/pipeline/orchestrator.ts:124-132`
- 결과는 batch schema로 파싱하고 실패 시 raw에서 블록 객체를 salvage한다: `src/lib/pipeline/orchestrator.ts:135-147`
- 누락/빈 번역을 기록한다: `src/lib/pipeline/orchestrator.ts:157-173`

평가: 이 부분은 프로젝트에서 가장 파이프라인다운 핵심이다. 상태를 누적하면서 순차 처리하므로 문체 일관성과 줄거리 연속성을 어느 정도 유지한다. 그러나 누락 블록은 즉시 재시도하지 않고 마지막 경고로만 남긴다. 잘못된 `blockId`, 중복 `blockId`, 배치 외 `blockId`도 필터링되지 않는다. 결과적으로 완성된 교재에 누락 또는 빈 원문 블록이 섞일 수 있다.

### 5. Pass 3: Revise

각 블록의 `annotations.flag_for_revision`이 true인 블록만 재검토한다.

- flagged 블록 수를 계산한다: `src/lib/pipeline/orchestrator.ts:196-199`
- flagged가 전체의 50% 미만일 때만 revise를 실행한다: `src/lib/pipeline/orchestrator.ts:199-247`
- revise 결과는 `JSON.parse`로만 처리한다: `src/lib/pipeline/orchestrator.ts:226-235`

평가: 선택적 재검토는 비용 절감에는 좋다. 하지만 절반 이상이 flag되면 재검토 단계가 통째로 생략된다. 이 경우 품질이 가장 나쁜 입력일수록 revise가 실행되지 않는다. 또한 Pass 1/2와 달리 `safeParseLLM`을 쓰지 않아 revise 결과 손실이 조용히 발생한다.

### 6. Synthesis

블록별 주해를 요약 문자열로 만들고, 종합 분석 JSON을 스트리밍 LLM으로 생성한다.

- annotated summary 생성: `src/lib/pipeline/orchestrator.ts:255-256`
- 스트리밍 호출은 하지만 UI에는 원문 chunk를 보내지 않고 상태 tick만 보낸다: `src/lib/pipeline/orchestrator.ts:261-278`
- 최종 JSON을 `SynthesisSchema`로 파싱한다: `src/lib/pipeline/orchestrator.ts:287-292`

평가: README에는 “Synthesis streamed MD”라고 되어 있지만 실제 구현은 JSON을 내부 스트리밍으로 수신하고, UI에는 Markdown chunk를 보내지 않는다. `synthesisMd`도 최종적으로 빈 문자열로 저장된다. 구조화된 `synthesis`는 존재하므로 보고서 렌더링 자체는 가능하지만, MD 다운로드 버튼과 README 설명은 실제 동작과 불일치한다.

### 7. Verify Agent

Verify는 유일하게 “에이전틱”이라고 부를 수 있는 부분이다.

- 오케스트레이터가 Verify Agent를 호출한다: `src/lib/pipeline/orchestrator.ts:294-316`
- Agent는 결말 1,500자를 읽고 검증한다: `src/lib/agents/verify-agent.ts:50-72`
- `UNCERTAIN`이면 결말 문맥을 3,000자로 확장해 최대 3회까지 반복한다: `src/lib/agents/verify-agent.ts:99-118`
- 최종 상태와 이슈를 반환한다: `src/lib/agents/verify-agent.ts:121-136`

평가: 여기에는 조건부 반복과 문맥 확장이라는 제한적 의사결정이 있다. 그러나 검증 대상은 주로 결말과 종합 보고서이며, 블록 번역 전체를 재검토하지 않는다. `CORRECTION`이 나와도 합성 보고서나 블록을 수정하지 않고, 최종 교재에 경고만 붙인다. 따라서 “검증까지 거친 교재”라기보다는 “검증 의견이 첨부된 교재”에 가깝다.

### 8. Assemble, 저장, 조회, PDF

검증 후 `TeachingMaterial`을 조립하고 파일 시스템에 저장한다.

- `assemble()` 호출 및 저장: `src/lib/pipeline/orchestrator.ts:340-384`
- 커버리지, fallback, verify 상태를 warning으로 계산한다: `src/lib/pipeline/orchestrator.ts:386-437`
- JSON은 `data/teaching-materials` 아래 UUID 파일로 저장된다: `src/lib/pipeline/storage.ts:16-20`, `src/lib/pipeline/storage.ts:75-88`
- 클라이언트는 complete 이벤트 수신 후 저장된 교재를 다시 fetch한다: `src/hooks/use-analysis.ts:238-270`

평가: SSE payload 크기 문제를 피하기 위해 저장 후 ID만 보내고 다시 조회하는 설계는 현실적이다. 다만 저장 경로가 `process.cwd()` 기반이고, 현재 `npm run build`에서 Turbopack NFT 경고가 발생한다. 또한 개별 ID 조회/삭제는 인증 없이 열려 있어 로컬 단일 사용자 도구라는 전제가 깨지면 위험하다.

## 파이프라인인가, 에이전틱 흐름인가

판정: **주 구조는 파이프라인, Verify만 제한적 에이전틱 루프**

이유:

1. 단계 순서가 고정되어 있다.
   - Profile → Block Batches → Revise → Synthesis → Verify → Assemble 순서가 코드에 하드코딩되어 있다.
   - 중간 결과에 따라 다음 도구를 선택하거나 계획을 재구성하지 않는다.

2. 대부분의 판단은 프롬프트 내부에 위임되어 있다.
   - 모델이 JSON 필드를 채우지만, 시스템은 결과를 받아 다음 고정 단계로 넘긴다.
   - 누락, 불확실성, 품질 저하가 발생해도 재분석 전략을 세우지 않는다.

3. 에이전트 루프는 Verify에만 있다.
   - `UNCERTAIN`이면 결말 문맥을 확장한다.
   - `VERIFIED`, `CORRECTION`, `UNCERTAIN`에 따라 종료 조건이 달라진다.
   - 하지만 수정안 적용, 추가 자료 탐색, 블록 재분석 호출은 없다.

따라서 외부 설명에서 “에이전틱 플랫폼”이라고 부르는 것은 마케팅 표현으로는 가능하지만, 아키텍처 관점에서는 **LLM 기반 다단계 배치 파이프라인**으로 분류하는 편이 정확하다.

## 주요 결함

### P0에 가까운 품질 결함

1. Verify 결과가 교재를 수정하지 않는다.
   - `CORRECTION`이어도 `assemble()`에는 기존 `profile`, `blocks`, `synthesis`가 그대로 들어간다.
   - 최종 이벤트는 `complete_with_warnings`로 바뀔 뿐이다.
   - 사용자는 “검증된 결과”라고 오해할 수 있다.

2. 장문 처리에서 Pass 1과 Synthesis가 컨텍스트 한계에 취약하다.
   - 분석 API는 200,000자까지 받지만 profile은 전체 텍스트를 한 번에 넣는다.
   - synthesis도 전체 블록 요약을 한 번에 넣는다.
   - 긴 작품일수록 핵심 결말, 복선, 인물 arc가 누락될 수 있다.

3. 누락 블록을 복구하지 않고 최종 산출물로 진행한다.
   - 커버리지 경고는 있지만 재시도, 해당 배치 재요청, 누락 블록 단독 분석이 없다.
   - `receivedIds`에 없는 블록은 최종 `blocks`에 빠진 상태로 저장될 수 있다.

### P1 결함

4. Revise 조건이 품질 저하 상황에 역행한다.
   - flagged가 전체의 50% 이상이면 revise를 생략한다.
   - 대량 오류 상황에서는 최소한 배치 재시도나 요약 경고 강화가 필요하다.

5. README/UI와 실제 synthesis 스트리밍이 불일치한다.
   - 타입에는 `synthesis_stream` 이벤트가 있고 클라이언트도 처리하지만, 오케스트레이터는 이 이벤트를 보내지 않는다.
   - `synthesisMd`는 빈 문자열로 완료된다.
   - MD 다운로드 버튼은 실질적으로 빈 보고서를 받을 가능성이 높다.

6. 사용자 취소가 서버 작업 취소로 이어지지 않는다.
   - 클라이언트는 `AbortController`로 fetch를 중단하지만, 서버 `ReadableStream`에는 `cancel()`에서 오케스트레이션을 멈추는 연결이 없다.
   - 긴 LLM 호출은 계속 실행될 수 있다.

7. 스캔/작품 추출이 문자열 위치 추정에 의존한다.
   - 제목의 두 번째 등장 위치를 본문 시작으로 간주한다.
   - Project Gutenberg 목차, 제목 반복, 장 제목 패턴이 다양하면 오분할 가능성이 있다.

### P2 결함

8. 동시성 제한이 단일 프로세스 메모리 카운터다.
   - 서버리스/멀티 프로세스 배포에서는 전체 동시성 제한으로 작동하지 않는다.

9. 저장소 조회/삭제에 인증 또는 소유권 모델이 없다.
   - 목록은 production에서 기본 비활성화되지만, ID를 알면 개별 조회/삭제 API는 열려 있다.

10. Build 경고가 남아 있다.
   - `npm run build`는 성공하지만 Turbopack이 `storage.ts`의 동적 파일 경로 때문에 “whole project traced unintentionally” 경고를 낸다.

## 강점

1. 단계별 책임 분리가 명확하다.
   - prompts, schemas, pipeline, storage, pdf가 잘 분리되어 있다.

2. JSON 복구 전략이 있다.
   - `safeParseLLM`이 fence 제거, JSON salvage, null normalization, partial salvage를 수행한다.
   - LLM 응답 실패를 완전 중단으로만 처리하지 않는 점은 실사용에 유리하다.

3. 커버리지와 fallback을 warning으로 표면화한다.
   - 품질 신호가 내부 로그에만 머물지 않고 완료 이벤트로 전달된다.

4. SSE payload 크기를 피하는 저장 후 재조회 구조가 좋다.
   - 긴 교재 JSON을 SSE로 직접 밀어 넣지 않는 선택은 안정적이다.

5. URL fetch의 SSRF 방어가 비교적 신중하다.
   - 사설 IP, localhost, redirect 재검증, 응답 크기 제한이 구현되어 있다.

## 완성도 점수

| 항목 | 점수 | 평가 |
|---|---:|---|
| 기본 E2E 플로우 | 8.0 | 입력부터 저장/PDF까지 연결됨 |
| 파이프라인 구조 명확성 | 8.0 | 단계 책임이 분명함 |
| 에이전틱 완성도 | 3.5 | Verify 한정 루프이며 수정 반영 없음 |
| 장문 안정성 | 5.5 | 전체 텍스트 단일 profile/synthesis가 병목 |
| 품질 회복력 | 6.5 | parse salvage는 좋지만 누락 재시도 없음 |
| UI/문서 일관성 | 6.0 | synthesis streaming/MD 설명과 구현 불일치 |
| 운영 안정성 | 6.5 | 취소, 동시성, 로컬 저장소 제약 있음 |
| 보안/배포 준비 | 6.5 | URL fetch는 좋지만 저장 API auth 없음 |

종합: **7.1 / 10**

## 우선순위 개선안

1. Verify `CORRECTION`을 실제 수정 플로우로 연결한다.
   - correction issue를 기반으로 synthesis 재작성 또는 affected block 재분석을 실행한다.
   - 최종 `VERIFIED`가 아니면 PDF 생성 버튼에 명확한 경고를 표시한다.

2. 누락 블록 자동 재시도를 추가한다.
   - 배치 결과에서 expected ID가 빠지면 해당 블록만 단독 재요청한다.
   - 중복/배치 외 blockId는 필터링하고 warning에 포함한다.

3. Pass 1을 장문 대응형으로 바꾼다.
   - 전체 profile 단일 호출 대신 chunk profile → merge profile 구조로 전환한다.
   - 결말/초반/중반/복선 후보를 별도 샘플링해 twist 오류를 줄인다.

4. Synthesis 출력 계약을 정리한다.
   - Markdown 스트리밍을 실제로 보낼지, 구조화 JSON만 쓸지 하나로 결정한다.
   - MD 버튼을 유지하려면 `synthesisToPlainText` 또는 Markdown 변환 결과를 저장해야 한다.

5. 사용자 취소를 서버 AbortSignal과 LLM fetch에 연결한다.
   - Route Handler에서 request signal 또는 stream cancel 상태를 orchestration에 전달한다.
   - 취소 시 counter를 즉시 줄이고 진행 중 LLM 호출을 abort한다.

6. 작품집 추출을 구조화한다.
   - LLM scan 결과에 title뿐 아니라 start/end marker 후보를 요구한다.
   - 클라이언트의 단순 두 번째 제목 매칭 대신 서버 측 extraction API를 일관되게 사용한다.

7. 저장소 경로와 배포 정책을 명확히 한다.
   - Turbopack 경고를 줄이도록 storage path를 정적 하위 폴더로 제한하거나 ignore 주석을 적용한다.
   - production에서는 ID 조회/삭제에도 인증 또는 비공개 토큰을 요구한다.

## 검증 결과

- `npm run lint`: 통과
- `npm run build`: 통과
- build 경고: `src/lib/pipeline/storage.ts` 경로 사용으로 Turbopack NFT 추적 경고 발생

## 최종 판정

현재 구현은 “작동 가능한 LLM 문학 교재 생성 파이프라인”으로는 꽤 완성도가 높다. 그러나 “에이전틱 흐름”이라고 부르기에는 자율적인 계획, 재시도, 수정 반영, 도구 선택이 부족하다. 특히 Verify가 오류를 발견해도 산출물을 고치지 않는 점과 장문 컨텍스트 병목은 완성도 평가에서 가장 큰 감점 요인이다.

따라서 이 프로젝트의 정확한 현재 상태는 다음과 같다.

> **LLM 기반 순차 분석 파이프라인 + 제한적 검증 에이전트. 실사용 가능한 프로토타입 이상이지만, 출판 수준 자동 교재 생성기로 주장하려면 품질 회복 루프와 장문 안정성을 보강해야 한다.**
