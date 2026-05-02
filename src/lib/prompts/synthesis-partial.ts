// v2 Phase B item 2 — Synthesis chunked-mode partial prompt.
// Used when annotated block count ≥ 150. Each call sees a chunk of the annotated
// block summaries and produces a partial Synthesis covering only what that chunk
// shows, plus the overall profile (which it can lean on for thesis/twist).

import type { WorkProfile } from "../schemas/profile";
import { summarizeProfileForBatch } from "../pipeline/batcher";

export interface SynthesisPartialPromptInput {
  profile: WorkProfile;
  /** 1-indexed for human readability (1 of N, 2 of N, …). */
  chunkIndex: number;
  totalChunks: number;
  /** "[blockId] commentary; flags…" lines from summarizeBlocksForSynthesis. */
  annotatedSummaryChunk: string;
}

export function buildSynthesisPartialPrompt(
  input: SynthesisPartialPromptInput,
): string {
  const profileSummary = summarizeProfileForBatch(input.profile);
  return `당신은 영미 단편 분석 한국어 교재 편집자입니다.
이 작품은 분량이 길어 분석 블록 요약을 ${input.totalChunks}개 청크로 나눠 처리합니다.
지금은 **청크 ${input.chunkIndex}/${input.totalChunks}** 입니다 — 이 청크에서 직접 관찰 가능한 내용만으로 부분 Synthesis를 작성하세요.

## 작품 프로파일 요약 (전체)
${profileSummary}

## 이번 청크의 블록 분석 요약
${input.annotatedSummaryChunk}

## 출력 지침
- **순수 JSON 단일 객체**만. 마크다운 펜스, 설명 절대 금지.
- 한국어 서술; 원문 인용만 영어.
- 이 청크에 보이는 블록만 근거로 사용. 다른 청크 내용은 추측 금지.
- thesis/twist/closing 같은 결말 의존 필드는 이 청크에 결말 블록이 없다면 빈 문자열로 두세요.

## JSON 스키마

{
  "thesis_ko": "이 청크 한정 핵심 명제 (없으면 빈 문자열)",
  "overview_essay_ko": "이 청크에서 다룬 부분의 개요 에세이 (200-400자)",
  "character_readings": [
    {
      "name": "이 청크에 등장한 인물명",
      "reading_ko": "이 청크 안에서의 인물 해석",
      "key_quote": { "en": "원문", "ko": "한국어 번역", "note_ko": "주석" }
    }
  ],
  "plot_reading_ko": "이 청크의 플롯 흐름 해설 (한국어)",
  "twist_reading": {
    "thesis_ko": "이 청크에 반전이 명백히 드러날 때만, 아니면 빈 문자열",
    "irony_direction_ko": "",
    "comparison_ko": "",
    "setup_moments": [],
    "payoff_moments": []
  },
  "symbolism_readings": [
    { "symbol": "이 청크에 보이는 상징", "reading_ko": "함의", "evidence": { "en": "원문", "ko": "한국어 번역" } }
  ],
  "tone_flow_ko": "이 청크 안 톤 변화 (한국어)",
  "style_essay_ko": "이 청크에 두드러진 문체 특징 (한국어)",
  "cultural_notes_ko": "이 청크에서 마주친 문화 참조 설명",
  "reading_guide_ko": ["이 청크 한정 독서 가이드 항목"],
  "closing_note_ko": "이 청크가 마지막 청크일 때만 결말 노트 작성, 아니면 빈 문자열"
}

JSON만 출력.`;
}
