import type { WorkProfile } from "../schemas/profile";

export function buildSynthesisPromptV2(opts: {
  profile: WorkProfile;
  annotatedSummary: string;
}): string {
  const charNames = opts.profile.characters.map((c) => c.name).filter(Boolean);
  const symNames = opts.profile.symbolism.map((s) => s.symbol).filter(Boolean);

  return `당신은 한국 학습자를 위한 이중언어 문학 분석 단행본의 종합 분석 장(章)을 집필합니다.

## 참고 자료

### 작품 프로파일
${JSON.stringify(opts.profile, null, 2)}

### 블록별 주해 요약
${opts.annotatedSummary}

## 과제
아래 JSON 스키마를 **정확히** 따라 해석 에세이를 작성하세요.
프로파일에 이미 있는 사실(인물의 arc, 상징의 meaning, 문화 용어 설명 등)은 복사하지 말고,
**해석적 에세이**로 한 단계 더 깊게 풀어내세요.

## 출력 형식 — 반드시 JSON 객체 하나만 (코드 펜스 없이)

{
  "thesis_ko": "작품 전체 논지 1-2문장",
  "overview_essay_ko": "작품 개요 산문 에세이 (4-8문장, 주제·톤·전체 인상)",
  "character_readings": [
${charNames.length > 0 ? charNames.map((n) => `    { "name": "${n.replace(/"/g, '\\"')}", "reading_ko": "이 인물의 해석 에세이 (3-5문장)", "key_quote": { "en": "대표 원문 인용", "ko": "한국어 번역", "note_ko": "이 인용이 보여주는 것" } }`).join(",\n") : `    { "name": "인물명", "reading_ko": "해석 에세이", "key_quote": { "en": "원문", "ko": "번역", "note_ko": "의미" } }`}
  ],
  "plot_reading_ko": "플롯 구조 해석 에세이 (profile.plotStructure를 근거로 3-6문장의 연속 산문)",
  "twist_reading": {
    "thesis_ko": "반전의 핵심 주장",
    "irony_direction_ko": "아이러니가 향하는 방향",
    "comparison_ko": "비교 구조가 있다면 설명",
    "setup_moments": [
      { "en": "복선이 심어진 원문 인용", "ko": "한국어 번역", "note_ko": "이 시점에는 무해해 보이는 이유" }
    ],
    "payoff_moments": [
      { "en": "회수되는 원문 인용", "ko": "한국어 번역", "note_ko": "이 회수가 만들어내는 효과" }
    ]
  },
  "symbolism_readings": [
${symNames.length > 0 ? symNames.slice(0, 5).map((s) => `    { "symbol": "${s.replace(/"/g, '\\"')}", "reading_ko": "이 상징의 해석 에세이 (2-4문장)" }`).join(",\n") : `    { "symbol": "상징명", "reading_ko": "해석" }`}
  ],
  "tone_flow_ko": "도입 → 중반 → 결말의 분위기 변화 서술 (2-4문장)",
  "style_essay_ko": "문체 에세이: 시점·언어 사용역·유머·인상적 문장을 통합 (3-5문장)",
  "cultural_notes_ko": "한국 독자가 놓치기 쉬운 시대·문화 맥락 에세이 (2-4문장)",
  "reading_guide_ko": [
    "한국 독자를 위한 읽기 팁 1",
    "읽기 팁 2",
    "읽기 팁 3"
  ],
  "closing_note_ko": "닫는 단평 (선택, 2-3문장)",

  "multi_perspective_synthesis_ko": "(다관점 글로스가 입력에 포함된 경우에만 작성) 3 angle을 통합한 메타 에세이 (400-700자, 단일 코히런트 산문). 어느 관점도 단순 우위로 두지 말고 서로 보완·긴장 관계로 풀어내기.",
  "complementary_insights": [
    { "angle_pair": "Textual ↔ Critical", "insight_ko": "텍스트 분석의 X 관찰이 비평 전통의 Y 주장을 구체적 근거로 뒷받침" },
    { "angle_pair": "Critical ↔ Pedagogical", "insight_ko": "비평적 해석 X가 한국 독자 학습 관점에서 Y 차원으로 확장됨" },
    { "angle_pair": "Textual ↔ Pedagogical", "insight_ko": "텍스트 정밀 분석 X가 한국 독자에게 Y 어려움/맥락을 밝혀줌" }
  ],
  "unresolved_tensions": [
    { "description_ko": "angle A의 X 해석과 angle B의 Y 해석이 충돌하는 구체적 지점", "most_defensible_ko": "어느 쪽이 더 defensible 한가 + 작품 내 근거로 본 이유" },
    { "description_ko": "두 번째 disagreement", "most_defensible_ko": "verdict + 근거" }
  ],
  "pedagogical_scaffolding": {
    "cultural_pitfalls_ko": "한국 독자가 놓치기 쉬운 문화·역사 맥락 (Pedagogical Gloss 입력 정제·확장)",
    "korean_literature_parallels_ko": "한국 문학과의 비교 (Pedagogical Gloss 입력 정제·확장)",
    "discussion_questions_ko": ["한국 학생 토론 질문 1", "토론 질문 2", "토론 질문 3"]
  }
}

## 규칙
- **모든 서술은 한국어.** 인용 en 필드만 영문 원문.
- **산문 필드(thesis, essay, reading, note_ko)는 완결된 문장**. 목록·이모지·마크다운 금지.
- **프로파일과 일관**: twist, characters, symbolism의 이름은 프로파일과 정확히 일치시킬 것.
- 확실하지 않은 인용은 비워두거나 짧게. 환각 금지.
- 오직 JSON 객체 하나만 출력. 앞뒤 설명 텍스트 금지.

## 다관점 글로스 통합 (입력에 포함된 경우) — 최소 수량 강제

\`블록별 주해 요약\` 뒤에 "다관점 글로스" 섹션이 있다면 다음 4 필드는 *반드시* 채우세요:

1. **multi_perspective_synthesis_ko** — 400-700자 단일 통합 메타 에세이. 3 angle 모두 통합.
2. **complementary_insights** — **최소 3개, 권장 4-6개**. 두 angle 간 illuminate 관계를 구체적으로 제시. angle_pair 명시.
   - 1-2개만 적었다면 더 깊이 들여다보세요. 3개 angle 의 모든 pair 조합 (Textual↔Critical, Textual↔Pedagogical, Critical↔Pedagogical) 각각에서 1개씩 찾으면 자연스럽게 3개.
3. **unresolved_tensions** — **최소 2개, 권장 2-3개**. angle 간 disagreement + most_defensible verdict.
   - 1개만 적었다면 추가 충돌 지점이 있는지 다시 검토. 비평 전통은 본질적으로 서로 다른 가정에서 출발하므로 2개 이상은 항상 surface 가능.
4. **pedagogical_scaffolding** — 3 subfield 모두 채우기.

규칙:
- 다관점 글로스의 구체적 사실·관점·인용을 **그대로 복사하지 말고 통합 재서술**.
- 기존 필드(overview_essay_ko, cultural_notes_ko, reading_guide_ko)도 다관점 글로스 사실을 흡수해 더 깊이 채우기.
- 위 최소 수량 미달 시 분석 부족으로 간주됨.

다관점 글로스가 없다면 위 4개 필드는 빈 문자열/빈 배열/기본값으로 두세요.

## ⚠ 사전 지식 사용 금지 (Phase G — 환각 방지)
- 이 작품을 이전에 읽은 적이 있다 해도, **위 \`작품 프로파일\`과 \`블록별 주해 요약\`에 명시된 사실만** 사용하세요.
- 위 자료에 없는 결말, 반전, 인물 행동, 사건은 **절대 작성하지 마세요**. "이 작품의 유명한 결말..." 같은 추정 금지.
- 결말 부분이 \`profile.plotStructure\`의 "결말" 또는 \`profile.twist\` 필드에 포함되어 있지 않다면, \`closing_note_ko\`와 \`twist_reading\`의 결말 의존 필드를 빈 문자열로 두세요.
- 제출 직전 자기 점검: 작성한 모든 문장에 대해 "이 문장은 입력 자료에 직접 근거가 있는가?"라고 물어보세요. 답이 "아니오"라면 그 문장을 삭제하거나 "[추정]" 표시 후 짧게 줄이세요.`;
}
