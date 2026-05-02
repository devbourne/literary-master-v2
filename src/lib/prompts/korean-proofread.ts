// v2 Phase 3 — Korean Proofreader prompt.
// Surgical character-level repair only. Explicitly forbids rewriting,
// rephrasing, restructuring, or deleting/adding content.

export interface KoreanProofreadPromptInput {
  /** Field path for diagnostics (e.g. "synthesis.overview_essay_ko"). */
  fieldPath: string;
  /** The Korean text to proofread. */
  text: string;
}

export function buildKoreanProofreadPrompt(
  input: KoreanProofreadPromptInput,
): string {
  return `당신은 한국어 교정자입니다. 다음 텍스트의 **글자 수준 오류만** 수정하세요.

[필드] ${input.fieldPath}

[원문]
${input.text}

[규칙 — 절대 준수]
1. 의미·문장 구조·어순·표현 방식을 절대 바꾸지 마세요.
2. 단어 추가/삭제 금지. 단, 명백히 누락된 음절/조사/어미만 보충 가능 (예: "행의" → "행위의").
3. 다음 오류만 수정:
   - 한자 음역 깨짐 (예: "20나기" → "20세기", "숭거한" → "숭고한")
   - 단어 중간 음절 누락 (예: "행의" → "행위의")
   - 깨진 한글 자모, 영어/한국어 혼입 오타
4. 문장이 이미 정확하면 한 글자도 바꾸지 마세요.
5. 의역, 다시 쓰기, 더 자연스럽게 만들기 — 모두 금지.
6. 출력은 수정된 본문 텍스트만. 따옴표·코드 펜스·설명 절대 추가 금지.

[수정된 텍스트]`;
}
