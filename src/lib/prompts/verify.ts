export function buildVerifyPrompt(opts: {
  ending: string;
  twist: string;
  report: string;
}): string {
  return `당신은 독립적인 문학 분석 검증자입니다.

## 과제
아래 원문 결말을 직접 읽고 **독립적으로** 해석한 뒤, 보고서가 정확한지 검증하세요.
사전 조사 결과는 참고만 하되, 반드시 원문에 근거하여 독립적으로 판단하세요.

## 원문의 마지막 부분 (직접 읽고 해석할 것)
${opts.ending}

## 참고: 사전 조사에서 파악한 반전 (이것이 틀릴 수 있음)
${opts.twist}

## 작성된 분석 보고서
${opts.report}

## 검증 절차

### Step A: 원문 결말 독립 해석
원문 마지막 부분을 직접 읽고 다음을 판단하세요:
1. 결말에서 실제로 무슨 일이 일어나는가?
2. 비교/대비 구조가 있다면, 정확히 무엇과 무엇이 비교되는가?
3. 어느 쪽이 더 나쁘거나/좋다고 제시되는가?
4. 축소 표현(only, merely, just)이 있다면, 누구의/무엇의 크기를 줄이려는 것인가?

### Step B: 보고서 대조
위 독립 해석과 보고서를 비교하여:
1. 보고서의 반전/결말 해석이 원문과 일치하는가?
2. 비교 방향이 맞는가? (누가 더 나쁜지)
3. 주제 해석이 결말과 일관되는가?
4. 원문에 없는 내용(환각)이 포함되었는가?
5. 작가명이 정확한가?

## 출력 — JSON만 (코드 펜스 금지)

다음 스키마를 정확히 따르세요:

{
  "status": "VERIFIED" | "CORRECTION" | "UNCERTAIN",
  "summary": "검증 결과 한 문장 요약 (한국어)",
  "issues": [
    {
      "section": "ending | twist | theme | character | author | 기타 섹션명",
      "description": "문제의 구체적 설명",
      "suggested_fix": "원문에 근거한 수정안 (선택)"
    }
  ]
}

규칙:
- 문제가 전혀 없으면 "status": "VERIFIED", "issues": []
- 확신이 서지 않으면 "status": "UNCERTAIN"과 이유를 issues에 기록
- 원문과 불일치가 있으면 "status": "CORRECTION"과 섹션별 수정안을 issues에 기록
- 다른 텍스트 없이 JSON 객체 하나만 출력하세요`;
}
