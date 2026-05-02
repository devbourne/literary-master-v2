# literary-master v2 재설계 계획

작성일: 2026-04-22
근거: `literary-master_v1.md`, `Literary-master_완성도.md`, 현재 코드베이스 실측
목표: 완성도 7.1 → 8.7, 에이전틱/파이프라인 경계를 명시적으로 분리, **완결성(finalization) 보장**

---

## 1. v1 및 완성도.md에 대한 평가 요약

- 완성도.md는 아키텍처 진단(파이프라인 + 제한 Verify 에이전트)은 정확.
- Revise의 "flagged >50% → skip" 조건은 품질 최악일수록 수정을 포기하는 **반품질 설계** — 완성도.md가 짚었으나 원인으로 재분류 필요.
- Verify가 `CORRECTION`을 발견해도 산출물을 고치지 않는 점이 "완결성 부족"의 근본 원인.
- v1 Phase 3로 미뤄진 항목(auth, 멀티프로세스)은 v2에서도 유지 보류.

---

## 2. 에이전틱 vs 파이프라인 구분 원칙

"LLM을 호출하느냐"가 아니라 **결정이 어디에 있느냐**가 기준.

| 에이전틱 조건 | 파이프라인 조건 |
|---|---|
| 분기가 데이터 품질에 따라 변함 | I/O 계약 고정 |
| 잘못된 경로의 비용이 큼 | 단계 독립·병렬화 가능 |
| LLM이 자가진단 가능 | 순수 변환 |
| 반복/재시도 경계 설정 가능 | 실패 = 단순 fallback |

결정점 → 에이전트, 변환점 → 파이프라인. LLM 호출은 양쪽 모두에 존재 가능.

---

## 3. 단계별 재설계

### 3.1 Segmentation Agent (scan + extract 대체) — 🤖 에이전트

**현재**: `/api/scan`이 `single|collection` 판정 → 클라이언트가 제목 문자열 2번째 등장으로 추정.
**문제**: 제목 반복·TOC·대소문자 차이에서 오분할.
**v2**:
- Scan 반환 스키마 확장:
  ```ts
  { type: "collection", pieces: [
    { title, start_quote: "본문 첫 50자 quote", end_quote?: "다음 작품 직전 50자" }
  ]}
  ```
- 서버 측 extract가 quote로 경계 확정. 미발견 시 agent가 alt strategy(regex, fuzzy match, TOC skip) 최대 3회 재시도.
- 실패하면 수동 piece 선택 UI로 escalate.

**파일 영향**: `src/app/api/scan/route.ts`, 신규 `src/lib/agents/segmentation-agent.ts`, 클라이언트 piece extract 로직 삭제 → 서버 API 통합.

---

### 3.2 Profile Agent (Pass 1 단일 호출 대체) — 🤖 에이전트

**현재**: 전체 텍스트(최대 200k자) 단일 LLM 호출. Ollama context 32k 토큰 초과 위험.
**v2**: 길이·구조 기반 전략 라우팅.

| 입력 길이 | 전략 | 동작 |
|---|---|---|
| < 30k chars | `single-shot` | 현재 경로 유지 |
| 30–80k | `samples` | head 8k + mid 8k + tail 8k → merge profile |
| > 80k | `chunk-merge` | 20k 윈도우 chunk profile → agent가 conflict resolve |

- `merge`는 별도 LLM 호출: 여러 partial profile을 단일 `WorkProfileSchema`로 통합. Conflict 시 agent가 판정 (결말 우선, 반전 우선 등 규칙).

**파일 영향**: 신규 `src/lib/agents/profile-agent.ts`, `src/lib/prompts/profile-partial.ts`, `src/lib/prompts/profile-merge.ts`.

---

### 3.3 Block batches — ⚙️ 파이프라인 (유지)

**현재 유지할 것**: 5-block 배치, rolling summary, `safeParseLLM` + salvage.
**추가 방어**:
- Off-batch blockId 필터 (다른 배치 id 혼입 시 무시 + warning)
- 중복 blockId warning
- 각 배치의 parse 성공/실패 시그널을 orchestrator 레벨에서 누적 (기존 `fallbackCount`에 소스별 태깅)

---

### 3.4 Coverage Repair Agent (신규) — 🤖 에이전트

**현재**: 누락 블록은 경고만. 최종 저장물에 공백 블록이 남음.
**v2**:
```
after Pass 2:
  missing = expected - received
  empty = blocks with empty literary/literal

  for each id in missing + empty:
    call LLM with: profile_summary + prev_block + target_block_text + next_block
    parse into AnnotatedBlock
    if success: insert/replace at correct position
    else: retry up to 2 times
    if still missing: mark block.partial = true, note = "repair failed"
```

**파일 영향**: 신규 `src/lib/agents/coverage-repair-agent.ts`, `src/lib/prompts/block-single.ts`, `AnnotatedBlockSchema`에 `partial?: boolean` + `repair_reason?: string` 추가.

---

### 3.5 Quality Agent (Pass 3 Revise 조건 반전) — 🤖 에이전트

**현재**: `flagged > 50% → revise 전체 생략` (반품질).
**v2**: flagged 비율 분포로 분기.

| flagged % | 판정 | 동작 |
|---|---|---|
| < 30% | 일반 | 모든 flagged 블록 revise (현재 로직과 방향 일치) |
| 30–80% | 광범위 | flagged 블록 revise + 전체 배치에 coverage warning 강화 |
| > 80% | 대형 장애 | 실패 batch 식별 후 **해당 batch 통째로 1회 재시도** 먼저. 이후 재측정 |

- Revise 결과 파싱: 현재 `JSON.parse` → `safeParseLLM(ReviseSchema)`로 교체. Schema 신규.
- `ReviseSchema`: `{ revised_literary, revised_literal, revision_reason, changes_significant }`.

**파일 영향**: 신규 `src/lib/agents/quality-agent.ts`, `src/lib/schemas/revise.ts`, `src/lib/pipeline/orchestrator.ts` Pass 3 블록 로직 교체.

---

### 3.6 Synthesis — ⚙️ 파이프라인 (조건부 확장)

**현재**: 단일 JSON 호출.
**v2**:
- 블록 < 150 → 현재 유지
- 블록 ≥ 150 → annotated summary를 chunk로 분할해 mini-synthesis → merge (Profile Agent 전략 재사용)
- `synthesis_stream` 이벤트는 진행 tick로만 유지, 실제 MD 청크는 전송하지 않음을 문서화 (계약 정정).

---

### 3.7 Verify Agent v2 (대폭 강화) — 🤖 에이전트

**현재**: 결말 읽기 → 판정. `UNCERTAIN` 시 컨텍스트만 확장.
**v2**:
- `VERIFIED` → 종료
- `UNCERTAIN` → (1차) 컨텍스트 1500 → 3000자 확장, (2차) 의심 구간 cross-check (특정 claim 별도 질의)
- `CORRECTION` → 제안된 `suggested_fix`를 synthesis JSON 필드에 **적용**. 재검증. 루프 (max 3회).
- 최종 결과:
  - `VERIFIED` (처음부터) — 수정 없음
  - `VERIFIED after N corrections` — 수정 내역 로그
  - `CORRECTION unresolved` — max iter 도달, 남은 이슈를 warnings로

**새 스키마**:
```ts
VerificationResult {
  status: "VERIFIED" | "CORRECTION" | "UNCERTAIN"
  iterations: number
  corrections_applied: [{ section, before, after, iteration }]
  residual_issues: VerificationIssue[]
}
```

**파일 영향**: `src/lib/agents/verify-agent.ts` 확장, `src/lib/prompts/verify.ts` 업데이트, synthesis 필드 수정 유틸 신규.

---

### 3.8 Finalization Gate (신규) — ⚙️ 파이프라인

완결성 보장의 핵심. 명시적 state machine.

```
gate(signals):
  complete if:
    coverage_ratio >= 0.95
    && empty_blocks == 0
    && verify.status == "VERIFIED"
    && revise_pending == 0
    && profile_parse_ok

  complete_with_warnings if:
    (repair_attempts >= MAX_REPAIR || verify.iterations >= MAX_VERIFY)
    && has_partial_output
    // with remediation_summary: [{section, issue, reliability}]

  incomplete if:
    fatal_error || all_blocks_missing
    // retryable: true, resume_token for re-run
```

**UI 계약**:
- `complete` → 현재 동일
- `complete_with_warnings` → 상세 페이지 상단 노란 배너 + **섹션별 신뢰도 표시**. PDF 커버에 "부분 성공" 라벨
- `incomplete` → 저장 안 함, "재시도" 버튼. resume_token으로 profile/blocks 재사용

**파일 영향**: `src/lib/pipeline/orchestrator.ts` 마지막 블록 교체, `src/lib/types.ts` PipelineEvent 신규 state, `src/components/analysis-page.tsx`·`src/components/saved-detail.tsx`에 배너 컴포넌트.

---

### 3.9 Cancel propagation (신규) — ⚙️ 파이프라인

**현재**: 클라이언트 abort는 fetch만 끊고, 서버는 계속 실행.
**v2**:
- `ReadableStream`의 `cancel()` 콜백에서 AbortController signal을 trigger
- `orchestrate(text, send, sources, signal)` 시그니처 확장
- 모든 `callLLM`/`streamLLMChunks`에 signal 주입 → fetch signal 결합
- signal aborted 시 각 에이전트 loop 조기 종료 + counter 즉시 감소

**파일 영향**: `src/lib/llm.ts`, `src/lib/pipeline/orchestrator.ts`, `src/app/api/analyze/route.ts`, 모든 agent 파일.

---

### 3.10 synthesis_md 계약 정리 — ⚙️ 파이프라인

**현재**: 필드 존재하지만 빈 문자열, MD 버튼이 있지만 내용 없음.
**v2**:
- `synthesis_markdown` 필드 **폐지** (passthrough 스키마이므로 저장된 기존 파일은 무시됨)
- Export 시점에 `synthesisJsonToMarkdown(synthesis)` 헬퍼로 결정론적 직렬화
- UI의 MD 다운로드 버튼은 이 헬퍼 사용

**파일 영향**: `src/lib/pdf/synthesis-to-md.ts` 신규, `src/components/export-buttons.tsx`, `src/lib/schemas/teaching-material.ts`.

---

## 4. Phased 로드맵

| Phase | 기간 | 항목 | 완결성 기여 |
|---|---|---|---|
| **A. Core 완결성** | 3–4일 | Finalization Gate → Cancel → Coverage Repair Agent → Verify Agent v2 → off-batch filter | 완성도.md P0 전부 |
| **B. 장문 안정성** | 3–5일 | Profile Agent (strategy selection) → Synthesis 길이 대응 | 완성도.md P0 #2 |
| **C. 품질 재배치** | 2–3일 | Revise 로직 반전 (Quality Agent) → safeParseLLM 일관화 → synthesis_md 폐지 | 완성도.md P1 #4, #5 |
| **D. UX/스캔 정리** | 2–3일 | Segmentation Agent → 서버 측 extract 통합 → 재분석 버튼 | 완성도.md P1 #7 |
| **E. Productionization** | 별도 | Storage auth → Turbopack NFT → 멀티프로세스 동시성 | v1 Phase 3 계승 |

**합계**: A–D 약 10–15일, 완성도 목표 **8.7/10**.

---

## 5. 구현 순서 (blast radius 최소 → 최대)

1. **Finalization Gate** — 도착점 먼저 정의해야 개선이 연결됨
2. **Cancel propagation** — 긴 반복 테스트 전에 운영 안정성 확보
3. **Coverage Repair + Verify v2** — 독립 개발 가능, 품질 영향 최대
4. **Profile Agent** — 짧은 입력 사용자에게 영향 0
5. **Revise 로직 반전** — 작은 PR, 큰 심리 안전
6. **Segmentation Agent** — 작품집 사용 빈도에 따라 우선순위 조정

어느 지점에서 멈춰도 v1보다 항상 나아지는 순서.

---

## 6. 완성도 목표

| 항목 | v1 (완성도.md) | v2 목표 | 기여 항목 |
|---|---:|---:|---|
| 기본 E2E 플로우 | 8.0 | 8.5 | Gate |
| 파이프라인 구조 명확성 | 8.0 | 9.0 | 3.1–3.10 분리 |
| 에이전틱 완성도 | 3.5 | 7.5 | 5개 에이전트 추가 |
| 장문 안정성 | 5.5 | 8.0 | Profile / Synthesis Agent |
| 품질 회복력 | 6.5 | 8.5 | Coverage Repair, Quality |
| UI/문서 일관성 | 6.0 | 9.0 | MD 폐지, Gate UI |
| 운영 안정성 | 6.5 | 8.0 | Cancel |
| 보안/배포 준비 | 6.5 | 6.5 | Phase E 유보 |

**종합 목표: 8.7 / 10**

---

## 7. 비목표 (명시적)

- User 인증·세션·권한
- Multi-tenant 스토리지
- 마켓플레이스
- Academic pipeline
- 자동 튜닝·메타학습

이 항목들은 v1에서 Phase 3로 명시적으로 배제됨. v2도 유지.
