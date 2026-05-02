// v2 Phase B item 1 — Profile Agent merge prompt.
// Takes N partial WorkProfiles (each from a different window of the source text)
// and produces a single canonical WorkProfile. Encodes conflict-resolution rules
// the agent must follow (ending priority, twist priority, character merge by name).

export interface ProfileMergePromptInput {
  /** Stringified array of partial WorkProfile JSON objects. */
  partialProfilesJson: string;
  /** How many windows were sampled (for context in the prompt). */
  partialCount: number;
  /** Strategy that produced the partials — surfaced so the LLM understands coverage. */
  strategy: "samples" | "chunk-merge";
  /** Total source length, for the merger's context. */
  totalChars: number;
}

export function buildProfileMergePrompt(input: ProfileMergePromptInput): string {
  return `당신은 작품 분석 통합 편집자입니다. 동일 작품의 서로 다른 부분을 분석한 ${input.partialCount}개의 **부분 프로파일**이 주어졌습니다.
이를 단일 정식 WorkProfile JSON 하나로 통합하세요.

## 입력 정보
- 윈도우 전략: ${input.strategy}
- 전체 원문 길이: ${input.totalChars.toLocaleString()}자
- 부분 프로파일 개수: ${input.partialCount}

## 부분 프로파일들 (JSON 배열)
${input.partialProfilesJson}

## 통합 규칙 (반드시 준수)

1. **결말·반전 우선 (twist priority)**: \`twist\` 필드는 결말 또는 후반 윈도우에서 채워진 값을 우선 채택. 여러 윈도우가 모두 채웠다면 *가장 구체적*인 것을 선택.
2. **plotStructure 단계별 통합**: 각 단계(발단/전개/위기/절정/결말)는 가장 명확하게 묘사한 부분의 내용을 사용. 결말은 결말 윈도우 우선.
3. **인물 통합 (characters)**: 같은 \`name\`의 인물은 하나로 합칠 것.
   - arc_start: 도입 윈도우 우선
   - arc_middle: 중반 윈도우 우선
   - arc_end: 결말 윈도우 우선
   - defining_traits: 합집합 (중복 제거)
   - key_quotes: 합집합 (중복 제거)
4. **foreshadowing**: 모든 윈도우의 항목을 합집합. setup만 있고 resolution이 비어 있다가 다른 윈도우에서 resolution이 발견되면 합쳐서 완성.
5. **symbolism / themes / motifs**: 합집합. 명백히 같은 항목은 통합.
6. **author_style.narration**: 모든 윈도우가 일관되게 같은 시점이라야. 불일치 시 가장 빈번한 것 + 다른 것은 author_style.notable_passages에 별도 표기.
7. **빈 필드 채우기 우선순위**: title/author는 어느 윈도우든 비어있지 않은 값 채택. 모두 빈 경우만 빈 문자열/'(추정 불가)' 유지.
8. **모순 시 결말 우선 + 명시**: 두 윈도우가 사실 관계에서 충돌하면 결말에 가까운 윈도우 우선.

## 출력 지침
- 결과는 **순수 JSON 단일 객체**. 마크다운 펜스, 설명, 주석 금지.
- 모든 한국어 서술; 원문 근거 인용만 영어.
- 누락된 \`characters.arc_*\` 필드 절대 금지 — 윈도우 정보를 합쳐서라도 채워라.

## JSON 스키마 (단일 통합 WorkProfile)

{
  "title": "...",
  "author": "...",
  "meta": { "genre": "...", "era": "...", "length_category": "...", "language": "en|ko|mixed" },
  "themes": ["..."],
  "motifs": ["..."],
  "characters": [
    {
      "name": "...",
      "role": "...",
      "arc_start": "...",
      "arc_middle": "...",
      "arc_end": "...",
      "defining_traits": ["..."],
      "key_quotes": [{ "quote": "...", "significance": "..." }]
    }
  ],
  "symbolism": [{ "symbol": "...", "meaning": "...", "appearances": ["..."] }],
  "foreshadowing": [{ "setup": "...", "setupLocation": "...", "resolution": "...", "effect": "..." }],
  "plotStructure": [
    { "stage": "발단", "summary": "...", "evidence_quote": "..." },
    { "stage": "전개", "summary": "...", "evidence_quote": "..." },
    { "stage": "위기", "summary": "...", "evidence_quote": "..." },
    { "stage": "절정", "summary": "...", "evidence_quote": "..." },
    { "stage": "결말", "summary": "...", "evidence_quote": "..." }
  ],
  "tone_overall": "...",
  "tone_flow_summary": "...",
  "author_style": {
    "narration": "...",
    "dialect_register": "...",
    "humor_devices": ["..."],
    "notable_passages": [{ "quote": "...", "device": "..." }]
  },
  "twist": { "what": "...", "setup": "...", "payoff": "...", "irony_direction": "...", "comparison": "..." },
  "cultural_context": {
    "era_background": ["..."],
    "references": [{ "term": "...", "explanation_ko": "..." }]
  },
  "korean_brief": { "theme_ko": "...", "message_ko": "..." }
}

JSON만 출력.`;
}
