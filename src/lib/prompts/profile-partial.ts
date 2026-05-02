// v2 Phase B item 1 — Profile Agent partial-sample prompt.
// Used when the source text is too long to fit in a single profile call.
// Each call sees only one window of the text and is told so explicitly so
// the LLM doesn't fabricate plot details for sections it never read.

export interface ProfilePartialPromptInput {
  /** Identifier for the window — e.g. "head", "mid", "tail", "chunk 3/7". */
  windowLabel: string;
  /** What the window covers (e.g. "first 8000 chars", "chars 16000-24000"). */
  windowDescription: string;
  /** The text snippet itself. */
  windowText: string;
  /** Total source length so the LLM knows the window's relative scale. */
  totalChars: number;
}

export function buildProfilePartialPrompt(
  input: ProfilePartialPromptInput,
): string {
  return `당신은 영미 문학 분석 전문가입니다. 한 작품의 **부분만** 받았습니다 — 절대 보지 못한 장면을 지어내지 마세요.

## 윈도우 정보
- 라벨: ${input.windowLabel}
- 범위: ${input.windowDescription}
- 전체 텍스트 길이: ${input.totalChars.toLocaleString()}자

## 윈도우 텍스트
${input.windowText}

## 출력 지침
- **순수 JSON 단일 객체**만 출력. 마크다운 펜스, 설명, 주석 금지.
- 모든 한국어 서술; 원문 근거 인용만 영어.
- **이 윈도우에서 직접 확인 가능한 것만 채울 것.** 윈도우 밖 내용에 대한 추측 금지.
- 알 수 없는 필드는 빈 문자열/빈 배열. 작가명도 윈도우에서 못 찾으면 "(추정 불가)".
- twist 같은 결말 의존 필드는 윈도우에 결말이 없으면 비워두세요.

## JSON 스키마 (전체와 동일하나 부분 정보 OK)

{
  "title": "윈도우에서 추출 가능한 제목, 없으면 빈 문자열",
  "author": "윈도우에서 추출 가능한 작가명 또는 '(추정 불가)'",
  "meta": {
    "genre": "추측 가능한 장르 또는 빈 문자열",
    "era": "시대 배경 추측 또는 빈 문자열",
    "length_category": "추정 ('short' 등) 또는 빈 문자열",
    "language": "en | ko | mixed"
  },
  "themes": ["윈도우에서 보이는 주제만"],
  "motifs": ["윈도우에서 반복 관찰된 모티프만"],
  "characters": [
    {
      "name": "윈도우에 등장하는 인물명",
      "role": "관찰된 역할 또는 빈 문자열",
      "arc_start": "윈도우에서 본 모습 (없으면 빈 문자열)",
      "arc_middle": "윈도우에서 본 변화 (없으면 빈 문자열)",
      "arc_end": "윈도우에서 본 결말 모습 (없으면 빈 문자열)",
      "defining_traits": ["윈도우 관찰 특징"],
      "key_quotes": [
        { "quote": "원문 인용 (이 윈도우 내)", "significance": "왜 중요한가 (한국어)" }
      ]
    }
  ],
  "symbolism": [
    {
      "symbol": "이 윈도우의 상징",
      "meaning": "함의",
      "appearances": ["윈도우 내 단서"]
    }
  ],
  "foreshadowing": [
    {
      "setup": "윈도우 내 복선 인용",
      "setupLocation": "도입/전반/후반 (윈도우 라벨 기준)",
      "resolution": "윈도우에 회수 장면이 있다면 인용, 없으면 빈 문자열",
      "effect": "효과 (한국어, 윈도우 한정)"
    }
  ],
  "plotStructure": [
    { "stage": "발단|전개|위기|절정|결말 중 윈도우에 해당하는 단계만", "summary": "한국어", "evidence_quote": "원문" }
  ],
  "tone_overall": "윈도우 한정 톤 (한국어)",
  "tone_flow_summary": "윈도우 안에서의 톤 변화 (없으면 빈 문자열)",
  "author_style": {
    "narration": "관찰된 시점/화자",
    "dialect_register": "관찰된 사용역",
    "humor_devices": [],
    "notable_passages": [
      { "quote": "원문", "device": "기법 (한국어)" }
    ]
  },
  "twist": {
    "what": "윈도우에 결말 반전이 명백히 보일 때만 채움. 아니면 빈 문자열.",
    "setup": "윈도우 내 복선 인용 또는 빈 문자열",
    "payoff": "윈도우에 회수가 있을 때만, 아니면 빈 문자열",
    "irony_direction": "윈도우에서 명확히 보일 때만",
    "comparison": "윈도우에서 명확한 비교 구조만"
  },
  "cultural_context": {
    "era_background": ["윈도우 단서 기반 설명만"],
    "references": [
      { "term": "윈도우 속 문화·역사 용어", "explanation_ko": "한국어 설명" }
    ]
  },
  "korean_brief": {
    "theme_ko": "윈도우에서 보이는 주제 한 문장 또는 빈 문자열",
    "message_ko": "윈도우에서 추정 가능한 메시지 한 문장 또는 빈 문자열"
  }
}

JSON만 출력.`;
}
