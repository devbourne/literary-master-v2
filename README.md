# Literary Master

**영문 문학을 한국 학습자에게 — 이중언어 정밀 해설 교재 자동 생성**

Next.js + Ollama(gemma4) 기반의 에이전틱 문학 분석 플랫폼. 영어 단편·중편 작품을 입력하면 원문 + 문학적 번역 + 직역 + 블록별 주해 + 종합 보고서 + 검증까지 거친 **출판 수준 이중언어 교재 PDF**를 생성한다.

## 주요 기능

- **Pass 1 Profile**: 전체 텍스트를 한 번에 읽어 인물·플롯·복선·상징·반전·문체 통합 프로파일 생성
- **Pass 2 Block Annotations**: 단락 단위로 문학적 번역 + 직역 + 한국어 해설 + 풍부한 주해 (복선/상징/수사법/문화배경/핵심어휘)
- **Pass 3 Revise** (선택): flagged 블록만 재검토
- **Synthesis**: 이중언어 종합 분석 보고서 (Markdown, UI 스트리밍)
- **Verify**: 원문 결말을 독립적으로 재해석하여 보고서 검증
- **PDF 교재**: 45+페이지 이중언어 정밀 읽기 (Crimson Pro + Noto Serif KR) + 색상 주석 카드

## 기술 스택

| 계층 | 선택 |
|---|---|
| 프론트엔드 | Next.js 16 (App Router) + TypeScript |
| 백엔드 | Ollama `bjoernb/gemma4-26b-fast` (문학 분석 5/5 검증됨) |
| 스키마 | Zod (`.passthrough()` + `.default()` + `safeParseLLM`) |
| PDF | `puppeteer-core` + 시스템 Chromium (A4, 이중언어 2-column) |
| 스트리밍 | Server-Sent Events (상태·블록 진행·synthesis MD 스트리밍) |

## 파이프라인

```
입력 텍스트
   ↓
Pass 1: Profile (1 LLM 호출, 전체 텍스트)
   → WorkProfile JSON { title, themes, characters, foreshadowing, plotStructure, twist, ... }
   ↓
Pass 2: Block Batches (5개씩, rolling context)
   → AnnotatedBlock[] { literary_translation, literal_translation, korean_commentary, annotations }
   ↓
Pass 3: Revise (flagged only)
   → revised_literary_translation
   ↓
Synthesis (streamed MD)
   → 이중언어 종합 보고서
   ↓
Verify (독립 검증)
   → VERIFIED / CORRECTION
   ↓
Assemble (pure)
   → TeachingMaterial (schema_version: "2.0")
   ↓
PDF 렌더링 (2-column + 색상 카드)
```

## 주석 유형 (색상 카드)

| 유형 | 색상 | 설명 |
|---|---|---|
| 🔴 복선 (foreshadowing) | 빨강 | 복선이 심어진 지점 |
| 🩷 회수 (callback) | 진빨강 | 앞선 복선 회수 |
| 🟣 상징 (symbolism) | 보라 | 상징 키워드 |
| 🔵 톤 변화 (tone) | 파랑 | 분위기 전환 |
| 🟢 어휘 (vocab) | 초록 | 핵심 어휘 + 한국어 정의 |
| 🟡 문화·역사 (cultural) | 노랑 | 시대/문화 배경 |
| 🟦 수사법 (device) | 청록 | 은유·풍자·반어 등 |
| ⚪ 명문장 (quote) | 회색 | 인상적인 원문 문장 |

## 시작하기

```bash
npm install
# .env.local 설정
# OLLAMA_URL=http://localhost:11434/api/chat
# ANALYSIS_MODEL=bjoernb/gemma4-26b-fast
# OLLAMA_CTX=32768

npm run build
npm run start    # http://localhost:3000
```

## 프로젝트 구조

```
src/
├── lib/
│   ├── schemas/          # Zod 스키마 (profile, block, teaching-material, safe-parse)
│   ├── prompts/          # LLM 프롬프트 (profile, block-batch, pass3-revise, synthesis, verify)
│   ├── pipeline/         # 오케스트레이터 + blocker + batcher + assemble + storage
│   ├── agents/           # 에이전트형 단계 (verify-agent: CORRECTION/UNCERTAIN 루프)
│   ├── pdf/              # PDF 렌더러 (bilingual, annotation cards, CSS)
│   ├── adapters/         # (planned) 확장 어댑터 — 현재 미구현. 설계는 docs/implementation-plan.md 참고
│   ├── llm.ts            # Ollama 클라이언트
│   ├── parsers/          # JSON 복구 파서
│   └── types.ts          # 타입 re-export
├── app/api/
│   ├── analyze/          # 주 분석 SSE 엔드포인트 (입력 길이/동시성 제한)
│   ├── export/pdf/       # PDF 생성
│   ├── teaching-material/        # 저장 목록 GET · 수동 저장 POST
│   ├── teaching-material/[id]/   # 저장된 TM 조회 GET · 삭제 DELETE
│   ├── scan/             # 작품 감지
│   ├── extract/          # 개별 작품 추출
│   └── fetch-url/        # URL 페치
├── components/           # React UI
└── hooks/                # useAnalysis (SSE + reducer)

docs/                     # 구현 계획, 모델 비교, 벤치마크 문서
results/                  # 샘플 출력 (Gift of the Magi PDF + JSON)
```

## 샘플 결과물

`results/` 폴더:
- `gift-of-magi-sample.pdf` — O. Henry *The Gift of the Magi* 이중언어 교재 (45 페이지, 6.6MB)
- `gift-of-magi-sample.json` — 원본 TeachingMaterial (127KB)
- `unfinished-story-sample.json` — *An Unfinished Story* 분석 (220KB, 140 블록)

## 문서

- `docs/implementation-plan.md` — 전체 재설계 계획 (story-split 패턴 차용)
- `docs/model-comparison.md` — 4개 모델 비교 (gemma4 5/5 승)
- `docs/benchmark.md` — DGX Spark Ollama 벤치마크
- `docs/qwen36-benchmark.md` — vLLM Qwen3.6 벤치마크

## 검증 결과

| 작품 | 블록 | 번역 | 주해 | Verify |
|---|---|---|---|---|
| The Gift of the Magi | 39 | 100% | 42 devices, 58 vocab | ✅ |
| An Unfinished Story | 140 | 100% | 140 devices, 163 vocab | ✅ |

반전/아이러니 감지: O. Henry 단편 5개에서 5/5 정확도 (gemma4-26b-fast).
