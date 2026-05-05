// Verify Agent v2 — Stage 2: full-text fact grounding.
//
// Stage 1 (verify.ts) checks whether the report's *interpretation* of the
// ending is correct given just the ending. Stage 2 catches the failure mode
// Stage 1 was producing: claiming concrete facts mentioned anywhere in the
// report (proper nouns, named locations, specific objects) are "not in the
// original" when they actually appear earlier in the text. Stage 2 has the
// FULL text and is allowed to flag a claim ONLY when it cannot be supported
// by any substring of the original.
//
// Scope is intentionally narrow:
//   - Concrete factual claims only (named entities, specific objects,
//     direct quotations, attributed actions).
//   - Theme / symbolism / interpretive claims are OUT of scope here.
//   - Stage 2 cannot mark a CORRECTION on interpretation.

export function buildFullTextVerifyPrompt(opts: {
  fullText: string;
  report: string;
}): string {
  return `당신은 문학 보고서의 사실 근거를 검증하는 검토자입니다.

## 작업
**전체 원문**을 기준으로 보고서가 단정한 **구체적 사실들**이 실제로 원문에 있는지 확인하세요.
검증 범위는 좁게 한정합니다 — 해석·주제·상징의 의미는 검증하지 않습니다.

## 검증 대상 (구체 사실만)
- 고유명사: 인물 이름, 장소 이름, 거리 이름, 작품 속 사물 이름
- 직접 인용 또는 인용 형태로 제시된 표현
- 인물의 구체적 행동·발화·소유물에 대한 단정 서술

## 검증 비대상 (이 단계에서 판정 금지)
- 주제 해석 ("이 작품은 ~을 다룬다")
- 상징적 의미 ("X는 Y를 상징한다")
- 인물의 내면 해석 ("그녀는 ~을 느꼈을 것이다")
- 작품 전반의 톤/스타일/장르 평가
- 결말 해석 (Stage 1이 처리)

## 출력 — JSON만 (코드 펜스 금지)

{
  "status": "VERIFIED" | "CORRECTION",
  "summary": "전체 원문 대조 결과 한 문장 요약 (한국어)",
  "issues": [
    {
      "section": "fabricated",
      "description": "보고서가 단정한 구체 사실 X가 원문에 존재하지 않음을 명시. 보고서의 해당 문장을 짧게 인용.",
      "suggested_fix": "이 문장을 삭제하거나 [원문 미확인]으로 표시"
    }
  ]
}

규칙:
- 원문에 등장하는 사실이라면 단 한 번이라도 나타나면 VERIFIED 측에 둠 — 위치(도입부/중반/결말)는 무관.
- 부분 일치(예: 'priest'는 있으나 보고서가 '죽은 신부'라고 단정 — 'died'/'former tenant' 함께 등장하면 인정)는 OK로 간주.
- 단순 단어 검색이 아닌 **의미 단위 매칭**: 한국어 보고서가 "북부 리치먼드 거리"라고 쓰면 원문 "North Richmond Street"와 매칭됨.
- 사실 근거가 모호하지만 명백한 환각도 아닌 경우는 issue로 올리지 말고 VERIFIED.
- 환각이 0건이면 status: "VERIFIED", issues: []
- 환각이 1건 이상이면 status: "CORRECTION".
- 다른 텍스트 없이 JSON 객체 하나만 출력하세요.

## 전체 원문
${opts.fullText}

## 작성된 보고서
${opts.report}`;
}
