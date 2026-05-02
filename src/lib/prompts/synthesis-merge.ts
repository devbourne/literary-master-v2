// v2 Phase B item 2 — Synthesis chunked-mode merge prompt.
// Combines N partial Synthesis objects (one per chunk) into a single canonical
// Synthesis. Encodes merge rules so the LLM doesn't simply concatenate.

import type { WorkProfile } from "../schemas/profile";
import { summarizeProfileForBatch } from "../pipeline/batcher";

export interface SynthesisMergePromptInput {
  profile: WorkProfile;
  partialsJson: string;
  partialCount: number;
}

export function buildSynthesisMergePrompt(
  input: SynthesisMergePromptInput,
): string {
  return `당신은 작품 분석 통합 편집자입니다. 같은 작품의 ${input.partialCount}개 청크에서 만들어진 부분 Synthesis들을 단일 정식 Synthesis로 통합하세요.

## 작품 프로파일 요약 (참조용)
${summarizeProfileForBatch(input.profile)}

## 부분 Synthesis들 (JSON 배열)
${input.partialsJson}

## 통합 규칙

1. **thesis_ko**: 가장 결말에 가까운 청크의 명제 우선. 결말 청크가 비어 있다면 다른 청크 중 가장 구체적인 것.
2. **overview_essay_ko**: 청크 순서대로 자연스럽게 이어지는 단일 에세이로 재구성. 단순 연결 금지 — 도입·중반·결말이 한 흐름이 되도록 다시 쓰세요. 길이 400-700자.
3. **character_readings**: 이름이 같은 인물은 합칠 것. reading_ko는 각 청크의 관찰을 통합 — arc(도입→중반→결말) 순으로. key_quote는 가장 인상적인 인용 1개.
4. **plot_reading_ko**: 청크별 플롯 해설을 시간 순서대로 연결해 단일 서사로 다시 쓰기.
5. **twist_reading**: 결말 청크에서 채워진 값 우선. setup_moments/payoff_moments는 모든 청크의 합집합.
6. **symbolism_readings**: symbol 이름으로 합칠 것. reading_ko는 청크별 관찰을 통합.
7. **tone_flow_ko**: 청크별 톤을 시간 순서로 잇기.
8. **style_essay_ko**: 모든 청크의 문체 관찰을 통합.
9. **cultural_notes_ko**: 모든 청크의 합집합 (중복 제거).
10. **reading_guide_ko**: 모든 청크 항목의 합집합. 중복 또는 너무 비슷한 항목은 통합.
11. **closing_note_ko**: 결말 청크의 값 채택. 결말 청크가 비어 있으면 작성 시도.

## 출력 지침
- **순수 JSON 단일 객체**만 출력. 마크다운 펜스, 설명, 주석 절대 금지.
- 한국어 서술; 원문 인용만 영어.

## JSON 스키마

{
  "thesis_ko": "...",
  "overview_essay_ko": "...",
  "character_readings": [
    { "name": "...", "reading_ko": "...", "key_quote": { "en": "...", "ko": "...", "note_ko": "..." } }
  ],
  "plot_reading_ko": "...",
  "twist_reading": {
    "thesis_ko": "...",
    "irony_direction_ko": "...",
    "comparison_ko": "...",
    "setup_moments": [{ "en": "...", "ko": "...", "note_ko": "..." }],
    "payoff_moments": [{ "en": "...", "ko": "...", "note_ko": "..." }]
  },
  "symbolism_readings": [
    { "symbol": "...", "reading_ko": "...", "evidence": { "en": "...", "ko": "..." } }
  ],
  "tone_flow_ko": "...",
  "style_essay_ko": "...",
  "cultural_notes_ko": "...",
  "reading_guide_ko": ["..."],
  "closing_note_ko": "..."
}

JSON만 출력.`;
}
