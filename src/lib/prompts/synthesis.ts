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
  "closing_note_ko": "닫는 단평 (선택, 2-3문장)"
}

## 규칙
- **모든 서술은 한국어.** 인용 en 필드만 영문 원문.
- **산문 필드(thesis, essay, reading, note_ko)는 완결된 문장**. 목록·이모지·마크다운 금지.
- **프로파일과 일관**: twist, characters, symbolism의 이름은 프로파일과 정확히 일치시킬 것.
- 확실하지 않은 인용은 비워두거나 짧게. 환각 금지.
- 오직 JSON 객체 하나만 출력. 앞뒤 설명 텍스트 금지.

## 다관점 글로스 입력 활용 (입력에 포함된 경우)

\`블록별 주해 요약\` 뒤에 "다관점 글로스" 섹션이 있다면 그 안의 구체적 관찰·사실·관점을 흡수하여
**기존 12개 필드를 더 깊이 채우세요** (overview_essay_ko, plot_reading_ko, character_readings,
cultural_notes_ko, style_essay_ko, tone_flow_ko, reading_guide_ko 등).

다관점 통합 메타 분석 (multi_perspective_synthesis 등)은 **이 호출에서 작성하지 마세요** — 별도 후속
호출 (Stage 4b) 에서 처리됩니다. 이 호출은 위 12개 필드만 정확히 채우는 데 집중하세요.

## ⚠ 사전 지식 사용 금지 (Phase G — 환각 방지)
- 이 작품을 이전에 읽은 적이 있다 해도, **위 \`작품 프로파일\`과 \`블록별 주해 요약\`에 명시된 사실만** 사용하세요.
- 위 자료에 없는 결말, 반전, 인물 행동, 사건은 **절대 작성하지 마세요**. "이 작품의 유명한 결말..." 같은 추정 금지.
- 결말 부분이 \`profile.plotStructure\`의 "결말" 또는 \`profile.twist\` 필드에 포함되어 있지 않다면, \`closing_note_ko\`와 \`twist_reading\`의 결말 의존 필드를 빈 문자열로 두세요.
- 제출 직전 자기 점검: 작성한 모든 문장에 대해 "이 문장은 입력 자료에 직접 근거가 있는가?"라고 물어보세요. 답이 "아니오"라면 그 문장을 삭제하거나 "[추정]" 표시 후 짧게 줄이세요.`;
}
