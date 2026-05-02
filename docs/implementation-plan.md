# 한국 학습자용 이중언어 문학 분석 플랫폼 — v2 재설계

## Context

현재 `text-analysis` 앱은 chunk 병합 로직의 경직성으로 인물 arc middle/end, 복선 회수, style 섹션 등이 비어 PDF 교재에 공백이 발생한다. 원인은 chunk 단위 병합이 LLM 출력 변동을 감당하지 못하는 것이다.

**재설계 목표:**
1. **한국 학습자**가 영어 원문 문학을 깊이 이해하도록 — 이중언어 번역 + 한국어 주해
2. **chunk 병합 제거** — story-split 패턴의 "Pass 1 Profile (통합 JSON)"으로 전환
3. **블록 단위 주해** — 문단(paragraph)마다 복선/상징/톤/어휘/문화배경 태그
4. **수능 출제 제거** — 충실한 분석·해설이 기반. 출제는 미래 어댑터로 분리
5. **Survey·Verify는 유지** — twist 감지와 검증 정확도 우수

## 참조: devbourne/story-split
- 3-pass: Profile → Block translations+annotations → Revise flagged
- Zod 스키마 + `safeParseLLM` (markdown fence 제거 + FALLBACK_MAP)
- Rolling context (previous translations + narrative summary 누적)
- 5-block 배치 처리

## 핵심 설계 결정

| 결정 | 이유 |
|---|---|
| **chunk → block(문단) 전환** | 병합 불필요, 세밀한 주해 가능 |
| **Pass 1 통합 Profile** | 인물 arc/복선/톤을 한 번에 생성, 병합 제거 |
| **literary + literal 번역** | 문학적 + 학습용 직역 둘 다 |
| **Zod + passthrough + defaults** | LLM 변동에 robust, hand-written validator 대체 |
| **Survey를 Profile에 통합** | twist 감지 프롬프트 재사용, 별도 step 제거 |
| **Verify 유지** | 독립 검증 가치 입증됨 |
| **어댑터 패턴** | 수능/학습지 등 확장 분리 |

## 새 파이프라인 (6-step)

```
Pass 1: Profile (1 LLM call, non-streaming)
  Input: 원문 전체
  Output: WorkProfile {
    title, author, meta,
    themes[], motifs[],
    characters[{ name, role, arc_start/middle/end, defining_traits, key_quotes[] }],
    symbolism[], foreshadowing[{ setup, resolution, effect }],
    plotStructure[{ stage(발단~결말), summary, evidence_quote }],
    tone_overall, tone_flow_summary,
    author_style { narration, dialect_register, humor_devices[], notable_passages[] },
    twist { what, setup, payoff, irony_direction, comparison },  // ← 기존 Survey 통합
    cultural_context,
    korean_brief { theme_ko, message_ko }
  }
  Zod validated with defaults + passthrough

Pass 2: Block Batches (5-block씩, rolling context)
  Input per batch: 5 blocks + profileSummary + rollingSummary + previousTranslations
  Output per block:
    - literary_translation (자연스러운 한국어)
    - literal_translation (학습용 직역)
    - korean_commentary (2-3문장 해설)
    - annotations {
        containsForeshadowing, foreshadowingSetupRef,
        containsCallback, callbackRef,
        toneShift, sceneTransition,
        symbolismPresent[], literaryDevices[{device, description_ko}],
        culturalReferences[{term, explanation_ko}],
        key_vocabulary[{en, pos, ko_gloss, context_note_ko}],
        notable_quote, dialogueSpeaker,
        ambiguity_level, translation_difficulty,
        flag_for_revision, flag_reason
      }

Pass 3: Revise (선택, flag_for_revision만)
  전체 컨텍스트로 재검토 → revised_literary/literal_translation

Synthesis: Markdown 스트리밍 (UI UX 유지)
  Input: Profile + annotated blocks summary
  Output: 한국어 이중언어 분석 보고서

Verify: 독립 검증 (원문 마지막 부분 + profile.twist)
  → VERIFIED or CORRECTION

Assemble: 순수 결정론적 조립
  TeachingMaterial = Profile + Blocks + SynthesisMD + Verify + stats
```

## Zod 스키마 (핵심)

`src/lib/schemas/` 신설:
- `profile.ts`: WorkProfileSchema (CharacterSchema, ForeshadowingSchema, TwistSchema 등)
- `block.ts`: AnnotatedBlockSchema, AnnotationSchema, BatchResponseSchema
- `teaching-material.ts`: TeachingMaterialSchema v2.0 (profile + blocks + synthesis_markdown + verification + adapter_outputs)
- `safe-parse.ts`: `safeParseLLM(schema, raw, fallback)` + `stripMarkdownFence`

모두 `.passthrough()` + `.default()` 조합으로 필드 누락/추가 허용.

## 이중언어 PDF 레이아웃

**2-column bilingual passage** (원문/번역) + **annotation cards** 색상 구분:
- 🔴 복선 (card-foreshadowing)
- 🩷 회수 (card-callback)
- 🟣 상징 (card-symbolism)
- 🔵 톤 (card-tone)
- 🟢 어휘 (card-vocab)
- 🟡 문화·역사 (card-cultural)
- 🟦 수사법 (card-device)
- ⚪ 명문장 (card-quote)
- ⬜ 장면전환 (card-scene)

**PDF 섹션 순서:**
1. 표지 (Korean subtitle "영문 원작 정밀 해설")
2. 목차
3. Profile overview (주제·반전·인물·상징·문화)
4. **Bilingual annotated passage** (핵심 신규)
5. Synthesis report (MD → HTML)
6. 어휘 마스터 (블록 vocab 집계 + 중복 제거)
7. 검증 노트 (CORRECTION 있을 때)
8. 어댑터 출력 (있을 때)

## 어댑터 패턴

`src/lib/adapters/`:
```ts
interface Adapter<T> {
  name: string; version: string; description: string;
  generate(input: { profile, blocks, synthesisMd? }): Promise<T>;
  renderPdfSection?(data: T): string;
}
```

Registry: `registerAdapter()`, `getAdapter()`, `listAdapters()`.

초기 어댑터: `study-materials` (어휘+토론). 미래: `exam`, `worksheet`.

엔드포인트: `POST /api/adapters/[name]` — 저장된 TeachingMaterial을 받아 어댑터 실행.

## 파일 구조

```
src/
├── lib/
│   ├── schemas/                 # [NEW] Zod
│   │   ├── safe-parse.ts
│   │   ├── profile.ts
│   │   ├── block.ts
│   │   └── teaching-material.ts
│   ├── prompts/
│   │   ├── profile.ts           # [NEW] Pass 1 (Survey 통합)
│   │   ├── block-batch.ts       # [NEW] Pass 2
│   │   ├── pass3-revise.ts      # [NEW] Pass 3
│   │   ├── synthesis.ts         # [REWRITE] Profile 기반
│   │   └── verify.ts            # [KEEP]
│   │   # DELETE: survey, chunk-analysis, problems, detection
│   ├── pipeline/
│   │   ├── orchestrator.ts      # [REWRITE]
│   │   ├── blocker.ts           # [NEW] 문단 분할
│   │   ├── batcher.ts           # [NEW] 5-block 배치 + rolling context
│   │   └── assemble.ts          # [REPLACE] 단순 매핑
│   │   # DELETE: chunker.ts
│   ├── adapters/                # [NEW]
│   │   ├── registry.ts
│   │   ├── study-materials.ts
│   │   └── index.ts
│   ├── pdf/
│   │   ├── bilingual-renderer.ts  # [NEW] 2-column
│   │   ├── annotation-cards.ts    # [NEW] 색상 카드
│   │   ├── section-renderers.ts   # [NEW] 표/타임라인 (profile 직접 사용)
│   │   ├── pdf-renderer.ts        # [REFACTOR] 섹션 오케스트레이션
│   │   ├── css.ts                 # [REFACTOR] + 카드 스타일
│   │   ├── browser.ts             # [KEEP]
│   │   └── escape.ts              # [KEEP]
│   │   # DELETE: validate-teaching-material.ts (Zod가 대체)
│   ├── llm.ts                    # [KEEP]
│   ├── parsers/json-parser.ts    # [KEEP as safeParseLLM fallback]
│   └── types.ts                  # [REFACTOR] re-export from schemas
├── app/api/
│   ├── analyze/route.ts          # [UPDATE] new event types
│   ├── export/pdf/route.ts       # [UPDATE] Zod 검증
│   └── adapters/[name]/route.ts  # [NEW]
├── hooks/
│   └── use-analysis.ts           # [REFACTOR] phase-based reducer
└── components/
    ├── pipeline-viewer.tsx       # [REFACTOR] phase + block grid
    ├── export-buttons.tsx        # [UPDATE] adapter 버튼 추가
    ├── input-panel.tsx           # [KEEP]
    └── piece-picker.tsx          # [KEEP]
```

## SSE Event 타입 (확장)

```ts
type PipelinePhase = "profile" | "blocks" | "revise" | "synthesis" | "verify" | "done";

type PipelineEvent =
  | { type: "status"; phase: PipelinePhase; message: string }
  | { type: "profile_complete"; profile: WorkProfile }
  | { type: "batch_start"; batchIndex; totalBatches; blockIds }
  | { type: "batch_complete"; batchIndex; blocks; rollingSummary }
  | { type: "revise_one"; blockId }
  | { type: "synthesis_stream"; chunk }
  | { type: "verify_complete"; verified; text }
  | { type: "complete"; teachingMaterial; synthesisMd }
  | { type: "error"; message };
```

UI: phase별 카드 + 블록 그리드 (각 블록이 배치 완료 시 녹색/플래그 시 황색 chip).

## 의존성

- **추가**: `zod@^3.23`
- **제거 없음**: puppeteer-core, @sparticuz/chromium, react-markdown 유지

## 구현 순서

1. **Zod + schemas** (1h) — 컴파일 확인 후 기존 경로 동작 유지
2. **Pass 1 Profile prompt + 호출** (2h) — Gift of Magi 테스트로 JSON 검증
3. **Blocker + Batcher + Pass 2** (3h) — 배치별 로그, 블록 커버리지 ≥95%
4. **Pass 3 Revise** (1h) — flagged 비율 <25% 확인
5. **Assemble v2 + orchestrator 재작성** (2h) — 임시 legacy PDF로 shape 검증
6. **Synthesis v2** (1h) — 스트리밍 유지, profile-driven
7. **UI 이벤트/reducer 업데이트** (2h) — phase-based 표시
8. **PDF bilingual renderer + annotation cards** (3h) — 2-column + 색상 카드
9. **어댑터 scaffolding + study-materials** (1h)
10. **레거시 파일 제거** (0.5h) — 신규 경로 green 확인 후

**총 16.5시간**

## 테스트 전략

**Primary fixture**: *The Gift of the Magi* (2.2k 단어, 검증 가능한 반전)

| # | 테스트 | 기준 |
|---|---|---|
| T1 | Profile 구조 | twist.what 비어있지 않음, characters ≥2, foreshadowing ≥3, plotStructure 5단계 완전 |
| T2 | Twist 방향 | mutual sacrifice 정확히 식별, irony_direction 기술 |
| T3 | Block 개수 | 원문 문단 수의 ±15% 이내 |
| T4 | 이중언어 | 모든 블록에 literary_translation + literal_translation 있음, 서로 다름 |
| T5 | Flag 비율 | flagged < 25%, revision 후 다름 |
| T6 | Annotation 커버리지 | foreshadowing ≥3 블록, symbolism ≥2, vocab 총 ≥5 |
| T7 | Verify | verified === true |
| T8 | PDF | 200 OK, >50KB, application/pdf, 이중언어 렌더링 시각 확인 |
| T9 | 스키마 robust | 잘못된 JSON 주입 시 safeParseLLM이 defaults로 valid shape 반환 |
| T10 | Adapter | POST /api/adapters/study-materials 정상 동작 |

테스트 하네스: `scripts/test-pipeline.ts` (src 외부) — Gift of Magi 로드 → orchestrate 직접 호출 → T1~T7 프로그래밍 검증 → result JSON + PDF를 `test-out/`에 저장.

## 주요 수정 파일

- `src/lib/pipeline/orchestrator.ts` — 전면 재작성 (Pass1→Pass2 batches→Pass3→Synthesis→Verify→Assemble)
- `src/lib/schemas/profile.ts`, `block.ts`, `teaching-material.ts` — Zod 스키마
- `src/lib/prompts/profile.ts` — Survey twist 감지 프롬프트 통합
- `src/lib/prompts/block-batch.ts` — 5-block 배치 + rolling context + 전 주석 유형
- `src/lib/pdf/bilingual-renderer.ts` — 2-column 이중언어
- `src/lib/pdf/annotation-cards.ts` — 색상 카드 렌더링
- `src/lib/adapters/registry.ts` — 어댑터 확장점

## 검증 방법

1. `npm install zod`
2. Zod 스키마 작성 후 `npx next build` 통과 확인
3. Pass 1만 wire해서 Gift of Magi 호출 → profile JSON 확인 (T1, T2)
4. Pass 2 추가 → 블록 배치별 로그 확인 (T3~T6)
5. Pass 3 추가 → flagged 재검토 확인
6. 전체 end-to-end → `TeachingMaterial` JSON 전수 검증
7. PDF 생성 → 이중언어 + 주석 카드 시각 확인 (T8)
8. 어댑터 호출 → study-materials 동작 확인 (T10)
