# literary-master v1 비교 분석 보고서

작성일: 2026-04-20  
대상 경로: `/home/code/literary-master`  
비교 기준: 사용자가 제공한 `story-split v1 정밀 분석 보고서`  
분석 범위: Next.js 앱, AI 문학 분석 파이프라인, SSE API, PDF 생성, 임시 저장소, 문서/품질 게이트

---

## 1. 결론 요약

현재 `literary-master`는 `story-split v1`의 전체 제품 범위를 구현한 앱이 아니다. `story-split v1`이 인증, DB, PDF 업로드, 백그라운드 잡, 의미 검색, 과금, 관리자, 마켓플레이스까지 포함한 제품형 학습 스튜디오라면, `literary-master`는 그중 **문학 분석/번역/PDF 교재 생성 파이프라인만 떼어낸 경량 단일 앱**에 가깝다.

| 항목 | story-split v1 | literary-master |
|---|---|---|
| 제품 범위 | PDF 업로드, 사용자 프로젝트, DB, 검색, 번역, 과금, 관리자, 마켓플레이스 | 텍스트 입력 -> 문학 분석 -> 이중언어 PDF 생성 |
| 인증/권한 | NextAuth, USER/ADMIN, 소유권 정책 필요 | 없음 |
| DB | Prisma/PostgreSQL/pgvector | 없음 |
| 저장소 | 로컬 storage, 운영상 object storage 필요 | `/tmp/teaching_materials` JSON 임시 저장 |
| AI Provider | Gemini, OpenAI embedding | Ollama `bjoernb/gemma4-26b-fast` |
| 백그라운드 작업 | BackgroundJob/TranslationJob/worker | API 요청 안에서 SSE로 장시간 실행 |
| 파이프라인 | Fiction/Academic, Pass1/2/2.5/3/3.5 | Pass1 Profile -> Pass2 Block Batch -> Pass3 Revise -> Synthesis -> Verify |
| 과금/마켓 | 포인트, 가격표, 구매/관리자 배정 | 없음 |
| PDF | 업로드 PDF 파싱/렌더/스토리지 | 분석 결과를 Puppeteer PDF로 렌더 |

현재 프로젝트가 `story-split`에서 가장 강하게 차용한 부분은 **AI 분석 파이프라인 구조**다. README에도 Pass 1 Profile, Pass 2 Block Annotations, Pass 3 Revise, Synthesis, Verify, PDF 흐름이 명시되어 있고, 실제 오케스트레이터도 같은 순서로 구현되어 있다.

현재 상태를 점수화하면 다음과 같다.

| 항목 | 점수 | 판단 |
|---|---:|---|
| 문학 분석 파이프라인 완성도 | 7/10 | story-split 패턴을 잘 반영했고 샘플 결과물도 있음 |
| 제품 운영 기능 | 2/10 | 인증, DB, 권한, job, object storage가 없음 |
| 보안/권한 | 4/10 | 사용자 데이터 모델이 없어 P0 노출은 적지만, 결과 조회 접근 제어도 없음 |
| 데이터 지속성 | 2/10 | `/tmp` 임시 저장이라 운영 데이터로 보기 어려움 |
| AI 품질 방어 | 5/10 | Zod/safeParse/fallback은 있으나 부분 실패가 조용히 성공할 수 있음 |
| 코드 품질 게이트 | 4/10 | lint만 있고 typecheck/test/ci 스크립트가 없음 |
| 문서화 | 6/10 | README와 implementation-plan은 좋지만 adapters 등 일부 문서/구현 불일치가 있음 |

권장 방향은 `story-split`의 기능을 그대로 따라가는 것이 아니라, 현재 범위를 유지하면서 **AI 파이프라인 품질 보증, 임시 저장소/작업 안정성, 문서-구현 정합성**을 먼저 잡는 것이다.

---

## 2. 현재 구현 요약

### 2.1 앱 성격

`literary-master`는 Next.js + Ollama 기반의 문학 분석 앱이다. 사용자가 영어 단편/중편 텍스트를 입력하면 다음 결과를 생성한다.

| 결과물 | 내용 |
|---|---|
| WorkProfile | 제목, 작가, 주제, 인물, 상징, 복선, 플롯, 반전, 문화 배경 |
| AnnotatedBlock[] | 원문 블록별 문학 번역, 직역, 한국어 해설, 주석 |
| Synthesis Markdown | 이중언어 종합 분석 보고서 |
| Verification | 결말/반전 검증 결과 |
| TeachingMaterial JSON | schema_version `2.0`의 최종 조립 결과 |
| PDF | 이중언어 2-column + annotation card 교재 |

### 2.2 주요 파일 구조

| 영역 | 파일 |
|---|---|
| 분석 API | `src/app/api/analyze/route.ts` |
| PDF API | `src/app/api/export/pdf/route.ts` |
| 저장 결과 조회 | `src/app/api/teaching-material/[id]/route.ts` |
| 파이프라인 | `src/lib/pipeline/orchestrator.ts`, `blocker.ts`, `batcher.ts`, `assemble.ts`, `storage.ts` |
| 프롬프트 | `src/lib/prompts/profile.ts`, `block-batch.ts`, `pass3-revise.ts`, `synthesis.ts`, `verify.ts` |
| 스키마 | `src/lib/schemas/profile.ts`, `block.ts`, `teaching-material.ts`, `safe-parse.ts` |
| PDF | `src/lib/pdf/pdf-renderer.ts`, `bilingual-renderer.ts`, `annotation-cards.ts`, `css.ts` |
| UI | `src/components/analysis-page.tsx`, `pipeline-viewer.tsx`, `report-viewer.tsx`, `export-buttons.tsx` |

---

## 3. story-split v1과 직접 겹치는 부분

### 3.1 Pass 기반 AI 파이프라인

현재 구현은 `story-split`의 핵심 패턴인 다단계 분석을 거의 그대로 반영한다.

```text
입력 텍스트
  -> Pass 1: Profile
  -> Pass 2: 5-block batch annotations
  -> Pass 3: flagged block revise
  -> Synthesis streamed markdown
  -> Verify
  -> Assemble TeachingMaterial
  -> PDF render
```

| 단계 | 현재 구현 |
|---|---|
| Pass 1 Profile | 전체 텍스트를 한 번에 읽고 `WorkProfileSchema`로 검증 |
| Pass 2 Block Batches | `splitIntoBlocks()` 후 5개씩 묶어 `buildBlockBatchPrompt()` 호출 |
| Rolling context | `profileSummary`, `rollingSummary`, 최근 번역 2개를 다음 배치에 전달 |
| Pass 3 Revise | `flag_for_revision`이 true인 블록만 재검토 |
| Synthesis | `streamLLMChunks()`로 Markdown을 UI에 스트리밍 |
| Verify | 원문 마지막 1500자와 profile twist, report를 대조 |
| Assemble | `TeachingMaterial` v2.0으로 조립 |

### 3.2 Zod + LLM JSON 복구

`story-split` 보고서에서 언급된 `Zod + safeParseLLM` 전략이 현재 프로젝트에도 들어 있다.

| 구성 | 현재 구현 |
|---|---|
| markdown fence 제거 | `stripMarkdownFence()` |
| JSON 복구 파서 | `parseJsonFromLLM()` fallback |
| schema validation | Zod schema `safeParse()` |
| partial salvage | 가능한 필드만 살려 defaults와 병합 |
| passthrough/default | profile/block/teaching-material 스키마에 적용 |

이 전략은 LLM 출력 변동에 강하지만, 동시에 실패를 조용히 성공처럼 보이게 만들 수 있다.

### 3.3 이중언어 문학 교재 목표

`story-split`이 더 넓은 제품이라면, `literary-master`는 문학 교재 생성이라는 목적에 더 집중되어 있다.

| 기능 | 현재 구현 |
|---|---|
| 문학적 번역 | 있음 |
| 직역 | 있음 |
| 한국어 해설 | 있음 |
| 복선/회수/상징/톤/어휘/문화/수사법 카드 | 있음 |
| 종합 보고서 | 있음 |
| PDF | 있음 |
| 샘플 결과 | `results/gift-of-magi-sample.*`, `results/unfinished-story-sample.json` |

---

## 4. story-split P0 중 현재 직접 적용되지 않는 항목

`literary-master`는 아직 제품형 사용자/DB/과금 구조가 없기 때문에, `story-split v1` 보고서의 P0 상당수는 현재 직접 적용되지 않는다.

| story-split P0 | 현재 적용 여부 | 이유 |
|---|---|---|
| 작품 소유권 검증 누락 | 직접 해당 없음 | Story/Project/User DB 모델이 없음 |
| 전역 의미 검색 데이터 유출 | 해당 없음 | pgvector/embedding/search 없음 |
| 포인트 선차감 | 해당 없음 | 과금/포인트 없음 |
| destructive Prisma migration | 해당 없음 | Prisma/migration 없음 |
| 마켓플레이스 복사 데이터 손실 | 해당 없음 | 마켓플레이스 없음 |
| NextAuth secret fallback | 해당 없음 | 인증 없음 |

다만 제품화 과정에서 인증, DB, 저장소, 마켓플레이스를 붙이면 위 항목은 거의 그대로 선행 체크리스트가 된다.

---

## 5. 현재 프로젝트의 주요 리스크

### P0-1. 장시간 AI 작업이 API 요청 안에서 직접 실행됨

#### 근거

| 파일 | 내용 |
|---|---|
| `src/app/api/analyze/route.ts` | `maxDuration = 600` |
| `src/app/api/analyze/route.ts` | `ReadableStream.start()` 내부에서 `await orchestrate(text, send)` 실행 |
| `src/lib/pipeline/orchestrator.ts` | Profile, 모든 batch, revise, synthesis, verify를 한 요청 안에서 순차 실행 |

#### 영향

| 환경 | 위험 |
|---|---|
| 로컬/단일 서버 | 긴 분석 중 브라우저 연결이 끊기면 UX가 불안정함 |
| 서버리스 | timeout, cold start, stream 중단 위험 |
| 멀티 사용자 | 동시 요청이 늘면 LLM 호출과 PDF 작업이 웹 요청 처리와 충돌 |
| 운영 장애 | 중간 단계 재시도/재개가 어려움 |

#### 권장 해결

1. 당장은 현재 구조를 유지하되, 분석 길이 제한과 사용자-facing 실패 메시지를 강화한다.
2. `AnalysisJob` abstraction을 먼저 만든다. DB 없이도 local file/job map으로 시작할 수 있다.
3. 제품화 시 웹 API와 worker를 분리한다.
4. 단계별 checkpoint를 저장한다. Profile 완료, batch N 완료, synthesis 완료를 재사용 가능하게 한다.

---

### P0-2. `/tmp` 기반 임시 저장소와 접근 제어 부재

#### 근거

| 파일 | 내용 |
|---|---|
| `src/lib/pipeline/storage.ts` | `STORAGE_DIR = "/tmp/teaching_materials"` |
| `src/lib/pipeline/storage.ts` | `randomUUID().slice(0, 8)`로 id 생성 |
| `src/app/api/teaching-material/[id]/route.ts` | id만 알면 저장된 TeachingMaterial JSON 반환 |

#### 영향

| 문제 | 설명 |
|---|---|
| 데이터 유실 | `/tmp`는 재시작/배포/환경에 따라 사라질 수 있음 |
| 멀티 인스턴스 부적합 | A 인스턴스에 저장된 파일을 B 인스턴스가 읽을 수 없음 |
| 접근 제어 없음 | id를 알면 결과물 전체 조회 가능 |
| id 길이 짧음 | 8자리 UUID slice는 내부 도구에는 충분할 수 있지만 제품용으로는 약함 |

#### 권장 해결

1. 내부 도구라면 TTL cleanup과 id 길이 확장을 먼저 한다.
2. 결과 id를 최소 16-24자 이상으로 늘린다.
3. 저장 결과 조회에 signed token 또는 세션 바인딩을 추가한다.
4. 제품화 시 object storage + DB metadata 구조로 전환한다.

---

### P0-3. LLM fallback이 품질 실패를 숨길 수 있음

#### 근거

| 파일 | 내용 |
|---|---|
| `src/lib/schemas/safe-parse.ts` | schema validation 실패 시 partial salvage 또는 defaults 반환 |
| `src/lib/pipeline/orchestrator.ts` | `parsed.ok`가 false여도 batch 처리를 계속 진행 |
| `src/lib/pipeline/orchestrator.ts` | batch expected count와 실제 translations count를 로그만 남김 |
| `src/lib/pipeline/orchestrator.ts` | revise JSON parse 실패를 빈 catch로 무시 |

#### 영향

사용자는 "완료"를 보지만 실제로는 일부 블록이 빠졌거나, 기본값으로 채워진 빈 profile/block이 섞일 수 있다. 특히 문학 교재 생성에서는 누락된 블록, 빈 해설, 틀린 반전 감지가 품질 문제로 직결된다.

#### 권장 해결

1. `safeParseLLM` 결과의 `ok: false`를 `PipelineStats`에 누적한다.
2. batch별 `expected`, `received`, `missingBlockIds`를 저장한다.
3. coverage가 기준 미달이면 `complete`가 아니라 `error` 또는 `complete_with_warnings`로 보낸다.
4. revise parse 실패도 warning으로 저장한다.
5. PDF 표지 또는 검증 노트에 "부분 성공/검토 필요" 상태를 표시한다.

권장 기준:

| 지표 | 실패 기준 |
|---|---|
| block coverage | expected 대비 received < 95% |
| empty translation | literary/literal 중 하나라도 빈 블록 존재 |
| profile fallback | Profile parse `ok === false` |
| verify correction | `CORRECTION` 포함 |
| fallback count | 일정 횟수 이상 |

---

### P1-1. 문서와 구현의 불일치

#### 근거

| 문서 | 내용 |
|---|---|
| `README.md` | `src/lib/adapters/`를 프로젝트 구조에 포함 |
| `docs/implementation-plan.md` | `src/lib/adapters/registry.ts`, `study-materials.ts`, `app/api/adapters/[name]` 설계 |
| 실제 파일 구조 | `src/lib/adapters`와 `app/api/adapters/[name]` 없음 |

#### 영향

다음 개발자가 README만 보고 확장점이 구현되어 있다고 오해할 수 있다. 현재 앱을 "완성된 플랫폼"으로 착각하게 만드는 부분이다.

#### 권장 해결

둘 중 하나를 선택한다.

| 선택 | 작업 |
|---|---|
| 문서 정정 | README에서 adapters를 "planned"로 표시 |
| 구현 추가 | adapter registry와 study-materials adapter, API route 추가 |

현재 우선순위는 문서 정정이 더 현실적이다.

---

### P1-2. 테스트/품질 게이트 부족

#### 근거

`package.json` scripts는 다음뿐이다.

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint"
}
```

#### 문제

| 부족한 스크립트 | 영향 |
|---|---|
| `typecheck` | Next build 전 TS만 빠르게 검증하기 어려움 |
| `test` | pipeline, schema, blocker 회귀 방지 없음 |
| `ci` | lint/typecheck/build 일괄 검증 없음 |

#### 우선 테스트 대상

| 테스트 | 목적 |
|---|---|
| `splitIntoBlocks` | 문단/문장 분할 회귀 방지 |
| `safeParseLLM` | markdown fence, 깨진 JSON, fallback 동작 검증 |
| `TeachingMaterialSchema` | 샘플 JSON validation |
| batch coverage check | 누락 블록 감지 |
| PDF validation | 최소 HTML/PDF 생성 가능성 확인 |

---

### P1-3. API 입력 크기와 비용 제어 부족

#### 근거

`/api/analyze`는 `text`가 비어 있는지만 확인하고 길이 제한, 사용자 제한, 동시 실행 제한이 없다.

#### 영향

| 문제 | 설명 |
|---|---|
| 과도한 입력 | Ollama context를 넘거나 분석 시간이 폭증할 수 있음 |
| 동시 요청 | 로컬 모델/서버 리소스를 고갈시킬 수 있음 |
| 실패 UX | 긴 입력에서 어디까지 처리됐는지 복구하기 어려움 |

#### 권장 해결

1. 텍스트 길이 제한을 명시한다.
2. 예상 block count와 estimated time을 UI에 보여준다.
3. 서버에서 max block count를 제한한다.
4. 내부 도구라도 동시 실행 제한을 둔다.

---

### P1-4. Verify 판정이 문자열 포함 검사에 의존함

#### 근거

`orchestrator.ts`는 `verifyLLM.text.includes("VERIFIED") && !verifyLLM.text.includes("CORRECTION")`로 검증 성공을 판정한다.

#### 영향

LLM이 "not VERIFIED" 또는 "CORRECTION not needed"처럼 모호하게 응답하면 잘못 판정될 수 있다.

#### 권장 해결

1. Verify도 JSON schema로 강제한다.
2. `VerificationSchema`를 `status: "VERIFIED" | "CORRECTION" | "UNCERTAIN"` 형태로 확장한다.
3. report correction note를 구조화한다.

---

## 6. story-split에서 가져오면 좋은 것

현재 프로젝트에 당장 유용한 것은 기능 확장이 아니라 운영 안정성 패턴이다.

| story-split 교훈 | literary-master 적용 |
|---|---|
| 권한 중앙화 | 제품화 시 result/story access guard를 먼저 설계 |
| worker 분리 | 장시간 analysis job을 웹 요청에서 분리 |
| fallback 가시화 | LLM fallback/warning/coverage metric 저장 |
| storage abstraction | `/tmp` 직접 접근 대신 storage interface 도입 |
| 품질 게이트 | typecheck/test/ci 스크립트 추가 |
| 상태 모델 | PipelinePhase와 result status를 enum/const로 통합 |

---

## 7. 반대로 아직 가져오지 않는 것이 나은 것

`story-split`의 다음 기능은 현재 앱에 바로 넣지 않는 편이 낫다.

| 기능 | 보류 이유 |
|---|---|
| NextAuth/User/Admin | 현재는 단일 분석 도구이므로 복잡도 증가가 큼 |
| Prisma/PostgreSQL | 저장해야 할 도메인 모델이 아직 단순함 |
| pgvector/search | 문학 교재 생성 MVP에는 직접 필요하지 않음 |
| 포인트 과금 | 품질/안정성 검증 전 과금은 위험 |
| 마켓플레이스 | 공개/구매/소유권 정책이 선행되어야 함 |
| Academic pipeline | 현재 브랜드는 문학 분석에 집중되어 있음 |

---

## 8. 권장 로드맵

### Phase 0. 현재 앱 안정화

기간: 1-2일

| 작업 | 완료 기준 |
|---|---|
| batch coverage metric 추가 | expected/received/missingBlockIds가 stats에 남음 |
| fallback count 저장 | `safeParseLLM ok=false` 횟수가 TeachingMaterial에 기록됨 |
| complete_with_warnings 이벤트 추가 | 부분 성공을 UI가 구분함 |
| verify JSON schema화 | 문자열 포함 판정 제거 |
| 저장 id 길이 확장 | 최소 16자 이상 |
| README adapters 문구 정정 | planned/implemented 구분 |

### Phase 1. 품질 게이트 추가

기간: 2-4일

| 작업 | 완료 기준 |
|---|---|
| `typecheck`, `test`, `ci` script 추가 | 로컬에서 일괄 검증 가능 |
| blocker/safeParse/schema 테스트 | 핵심 유틸 회귀 방지 |
| sample JSON validation 테스트 | `results/*.json`가 schema 통과 |
| build/lint 상태 확인 | CI에 올릴 수 있는 baseline 확보 |

### Phase 2. 작업/저장소 추상화

기간: 1주

| 작업 | 완료 기준 |
|---|---|
| `AnalysisJob` abstraction | request와 pipeline state 분리 가능 |
| storage interface | local/tmp 구현 뒤 S3/R2로 교체 가능 |
| checkpoint 저장 | batch 단위 재시도/재개 가능 |
| 동시 실행 제한 | local Ollama 과부하 방지 |

### Phase 3. 제품화 판단

기간: 필요 시

| 제품화 방향 | 필요한 선행 작업 |
|---|---|
| 개인 계정 기반 저장 | Auth, DB, result ownership |
| 공유/공개 교재 | readable/writable policy |
| 유료 과금 | job idempotency, 성공 후 과금/예약-확정 모델 |
| 대량 처리 | dedicated worker, queue, object storage |

---

## 9. 우선 수정 대상 파일

| 우선순위 | 파일 | 수정 내용 |
|---|---|---|
| P0 | `src/lib/pipeline/orchestrator.ts` | coverage/warning/fallback metric, complete_with_warnings |
| P0 | `src/lib/schemas/safe-parse.ts` | warning reason을 caller가 기록할 수 있게 반환 강화 |
| P0 | `src/lib/schemas/teaching-material.ts` | qualityMetrics 또는 warnings 필드 추가 |
| P0 | `src/lib/prompts/verify.ts` | JSON 응답 schema 지시 |
| P0 | `src/lib/pipeline/storage.ts` | id 길이 확장, TTL metadata 준비 |
| P1 | `src/app/api/analyze/route.ts` | 입력 길이 제한, 명확한 error status |
| P1 | `package.json` | `typecheck`, `test`, `ci` script 추가 |
| P1 | `README.md` | adapters 미구현 상태 정정 |
| P1 | `src/lib/pipeline/blocker.ts` | 테스트 추가 |
| P1 | `src/lib/pdf/validate-teaching-material.ts` | Zod schema와 중복/불일치 확인 |

---

## 10. 최종 방향성

`literary-master`는 `story-split`의 축소판이라기보다, `story-split`의 AI 분석 패턴을 문학 교재 생성에 맞게 좁힌 별도 앱이다. 이 선택은 현재 단계에서 타당하다. 제품의 핵심 가치는 사용자 계정/마켓플레이스가 아니라 **영문 문학을 한국 학습자가 깊게 이해할 수 있는 이중언어 분석 결과물**에 있다.

따라서 다음 판단 기준을 유지하는 것이 좋다.

1. 먼저 문학 분석 품질과 누락 감지를 강화한다.
2. 다음으로 장시간 작업과 임시 저장소를 안정화한다.
3. 그 다음 테스트/CI와 문서 정합성을 맞춘다.
4. 인증, DB, 과금, 마켓플레이스는 제품화 필요가 명확해진 뒤 도입한다.

현재 코드베이스는 "제품형 플랫폼"보다는 "고품질 분석 엔진 MVP"에 가깝다. 지금 기능을 넓히기보다, 분석 결과가 틀리거나 빠졌을 때 그것을 정확히 감지하고 사용자에게 드러내는 쪽이 먼저다.
