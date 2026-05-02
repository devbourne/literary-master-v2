export function buildProfilePrompt(text: string): string {
  return `당신은 영미 문학 분석 전문가이며, 한국 고등학생·대학생이 영어 원문을 깊이 있게 읽도록 돕는 교재를 제작합니다.
아래 단편/소설 전체를 한 번에 읽고, 정밀 분석을 위한 **통합 프로파일**을 단일 JSON으로 출력하세요.

## 전체 원문
${text}

## 출력 지침 (매우 중요)
- 출력은 **순수 JSON 단일 객체**. 마크다운 펜스, 설명, 주석 모두 금지.
- 모든 서술(설명·해설·논평)은 **한국어**. 원문 근거 인용만 영어.
- 불확실한 필드는 빈 문자열/빈 배열로 두되, \`twist\`·\`plotStructure\`·\`themes\`는 반드시 채울 것.
- 작가명은 본문·표제·서명에서 추출이 가능한 경우에만. 확실치 않으면 "(추정 불가)".

## JSON 스키마

{
  "title": "작품 제목 (한 줄)",
  "author": "작가명 또는 '(추정 불가)'",
  "meta": {
    "genre": "short story | novella | novel | essay | ...",
    "era": "시대 배경 (예: 19세기 말 미국 남부)",
    "length_category": "micro | short | novella | novel",
    "language": "en | ko | mixed"
  },
  "themes": ["주제 1 (한국어)", "주제 2", "..."],
  "motifs": ["반복 모티프 1", "반복 모티프 2"],

  "characters": [
    {
      "name": "인물명 (영문 원어 그대로)",
      "role": "protagonist | antagonist | foil | supporting | narrator",
      "arc_start": "도입부에서의 상태·동기 (한국어, 2-3문장)",
      "arc_middle": "전환·갈등 국면의 변화 (한국어, 2-3문장)",
      "arc_end": "결말에서의 상태·깨달음 (한국어, 2-3문장)",
      "defining_traits": ["특징 1", "특징 2"],
      "key_quotes": [
        { "quote": "원문 인용", "significance": "왜 중요한가 (한국어)" }
      ]
    }
  ],

  "symbolism": [
    {
      "symbol": "상징물 (영문 또는 한국어)",
      "meaning": "함의하는 바 (한국어)",
      "appearances": ["원문 단서 1", "원문 단서 2"]
    }
  ],

  "foreshadowing": [
    {
      "setup": "복선이 심어진 원문 인용",
      "setupLocation": "어디쯤인지 (도입/전반/후반)",
      "resolution": "회수되는 원문 인용",
      "effect": "효과 (한국어)"
    }
  ],

  "plotStructure": [
    { "stage": "발단", "summary": "요약 (한국어)", "evidence_quote": "원문" },
    { "stage": "전개", "summary": "...", "evidence_quote": "..." },
    { "stage": "위기", "summary": "...", "evidence_quote": "..." },
    { "stage": "절정", "summary": "...", "evidence_quote": "..." },
    { "stage": "결말", "summary": "...", "evidence_quote": "..." }
  ],

  "tone_overall": "전체 톤 한 줄 (한국어)",
  "tone_flow_summary": "도입→중반→결말 톤 변화 요약 (한국어, 3-4문장)",

  "author_style": {
    "narration": "시점·화자 (1인칭 주인공/3인칭 관찰자 등)",
    "dialect_register": "방언·언어 사용역 특징",
    "humor_devices": ["기법 1", "기법 2"],
    "notable_passages": [
      { "quote": "원문 인용", "device": "사용 기법 (한국어)" }
    ]
  },

  "twist": {
    "what": "반전의 내용. 누가 무엇을 깨닫거나 드러나는가?",
    "setup": "어디서 복선이 심어졌는지 (원문 인용)",
    "payoff": "어디서 회수되는지 (원문 인용)",
    "irony_direction": "아이러니의 방향. 'only', 'merely', 'just' 같은 축소 표현이 실제로는 반대 의미를 함축하는지 확인할 것.",
    "comparison": "반전이 두 가지를 비교한다면, 어느 쪽이 더 나쁘고/좋다고 제시되는가?"
  },

  "cultural_context": {
    "era_background": ["시대 배경 설명 1", "설명 2"],
    "references": [
      { "term": "원문 속 문화·역사 용어", "explanation_ko": "한국어 설명" }
    ]
  },

  "korean_brief": {
    "theme_ko": "한국어로 요약한 주제 (한 문장)",
    "message_ko": "한국어로 요약한 메시지 (한 문장)"
  }
}

## 분석 시 반드시 지켜야 할 원칙
1. **마지막 장면을 정밀 정독**. 반전의 방향(누가 실제로 불리/유리한가)을 오판하지 말 것.
2. "only", "merely", "just" 같은 축소 표현은 **표면 의미와 반대일 수 있음**을 항상 의심할 것.
3. 비교·대비 구조가 있다면 누가/무엇이 더 크거나 작은지 명시할 것.
4. \`characters.arc_*\` 세 필드는 **모두** 채울 것. 특히 arc_middle·arc_end 공란 금지.
5. 원문에 없는 사실을 지어내지 말 것. 확신이 없으면 짧게 쓰되 거짓말하지 말 것.

JSON만 출력.`;
}
