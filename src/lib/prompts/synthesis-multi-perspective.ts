// v2.5 Synthesis split — Stage 4b prompt.
// Tight focused prompt that ONLY produces the 4 multi-perspective fields.
// Receives the 4a core synthesis JSON + the rendered multi-gloss section as
// context, asks the model to integrate them into 4 enrichment fields.
//
// Why this works where the all-in-one synthesis didn't: the model has only
// 4 output fields to keep coherent, the schema spec in the prompt is ~10
// lines instead of ~50, and there's no risk of one bad nested object
// (e.g. symbolism_readings) cascading-breaking JSON parse for downstream
// fields.

export interface SynthesisMultiPerspectivePromptInput {
  /** The 4a core synthesis output (12 existing fields), serialized JSON. */
  coreSynthesisJson: string;
  /** Rendered multi-gloss section (textual / critical / pedagogical). */
  multiGlossSection: string;
}

export function buildSynthesisMultiPerspectivePrompt(
  input: SynthesisMultiPerspectivePromptInput,
): string {
  return `당신은 다관점 문학 비평 통합 편집자입니다. 한 작품에 대한 1차 종합 분석(core synthesis)과 3개 관점의 다관점 글로스를 받아, **다관점 통합 결과 4개 필드만** 생성하세요.

## 1차 종합 분석 (참고용)
${input.coreSynthesisJson}

## 다관점 글로스 (3 angle)
${input.multiGlossSection}

## 출력 — 4개 필드만, JSON 객체 하나

### 필드 정의

1. **multi_perspective_synthesis_ko** (string): 3 angle을 통합한 메타 에세이. 400-700자, 단일 코히런트 산문. 어느 관점도 단순 우위로 두지 말고 서로 보완·긴장 관계로 풀어내기. 다관점 글로스의 구체적 사실·관찰을 통합 재서술.

2. **complementary_insights** (array, **최소 3개 필수**): 각 entry는
   { "angle_pair": "Textual ↔ Critical | Textual ↔ Pedagogical | Critical ↔ Pedagogical", "insight_ko": "두 angle이 서로 illuminate하는 구체적 지점 1-2 문장" }
   3개 angle pair를 가능한 모두 다루세요.

3. **unresolved_tensions** (array, **최소 2개 필수**): 각 entry는
   { "description_ko": "angle 간 disagreement 내용 (구체적)", "most_defensible_ko": "어느 쪽이 더 defensible 한가 + 작품 내 근거" }

4. **pedagogical_scaffolding** (object): {
     "cultural_pitfalls_ko": "한국 독자가 놓치기 쉬운 문화·역사 맥락 (Pedagogical Gloss 정제·확장)",
     "korean_literature_parallels_ko": "한국 문학과의 비교 (Pedagogical Gloss 정제·확장)",
     "discussion_questions_ko": ["토론 질문 1", "질문 2", "질문 3"]
   }

## 출력 형식

**순수 JSON 객체 하나만**. 코드 펜스, 설명, 다른 어떤 텍스트도 절대 금지.

{
  "multi_perspective_synthesis_ko": "...",
  "complementary_insights": [
    { "angle_pair": "Textual ↔ Critical", "insight_ko": "..." },
    { "angle_pair": "Critical ↔ Pedagogical", "insight_ko": "..." },
    { "angle_pair": "Textual ↔ Pedagogical", "insight_ko": "..." }
  ],
  "unresolved_tensions": [
    { "description_ko": "...", "most_defensible_ko": "..." },
    { "description_ko": "...", "most_defensible_ko": "..." }
  ],
  "pedagogical_scaffolding": {
    "cultural_pitfalls_ko": "...",
    "korean_literature_parallels_ko": "...",
    "discussion_questions_ko": ["...", "...", "..."]
  }
}

## 규칙
- 한국어만 (영문 인용은 angle_pair 라벨 정도만 허용)
- complementary_insights ≥ 3, unresolved_tensions ≥ 2 — 미달 시 분석 부족
- 1차 종합 분석에 이미 있는 사실은 복사 금지 — 다관점 글로스의 신규 정보를 통합
- 작품 외 사전 지식 사용 금지 (Phase G — 환각 방지)

JSON만 출력.`;
}
