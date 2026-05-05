// v2 Phase 3 — Korean Proofreader prompt.
// Surgical character-level repair only. Explicitly forbids rewriting,
// rephrasing, restructuring, or deleting/adding content.

export interface KoreanProofreadPromptInput {
  /** Field path for diagnostics (e.g. "synthesis.overview_essay_ko"). */
  fieldPath: string;
  /** The Korean text to proofread. */
  text: string;
  /** Optional glossary of {english_or_original → preferred Korean transliteration}.
   *  When supplied, the proofreader is told to enforce these mappings on any
   *  occurrence of the corresponding proper noun in the text. */
  transliterationGlossary?: Array<{ source: string; korean: string }>;
}

export function buildKoreanProofreadPrompt(
  input: KoreanProofreadPromptInput,
): string {
  const glossarySection =
    input.transliterationGlossary && input.transliterationGlossary.length
      ? `\n[고유명사 음역 사전 — 본문에 등장하면 이 표기를 사용]\n${input.transliterationGlossary
          .map((g) => `  ${g.source} → ${g.korean}`)
          .join("\n")}\n`
      : "";
  return `당신은 한국어 교정자입니다. 다음 텍스트의 **글자 수준 오류만** 수정하세요.

[필드] ${input.fieldPath}
${glossarySection}
[원문]
${input.text}

[규칙 — 절대 준수]
1. 의미·문장 구조·어순·표현 방식을 절대 바꾸지 마세요.
2. 단어 추가/삭제 금지. 단, 명백히 누락된 음절/조사/어미만 보충 가능 (예: "행의" → "행위의").
3. 다음 오류만 수정:
   - 한자 음역 깨짐 (예: "20나기" → "20세기", "숭거한" → "숭고한")
   - 단어 중간 음절 누락 (예: "행의" → "행위의")
   - 깨진 한글 자모, 영어/한국어 혼입 오타
   - **외국 문자 인젝션** — 한국어 본문에 키릴 문자(а, е, о, р, ь, л, н, к, в…), 그리스 문자, 잘못된 한자가 섞여 있으면 의도된 한글로 복원
     예: "소ль" → "소설", "20нагi" → "20세기", "сo년" → "소년"
   - **외국 고유명사 음역 일관성** — 위 사전이 있으면 본문의 변형 표기를 사전 표기로 통일
     예 (사전: Richmond → 리치먼드): "리치탈드" → "리치먼드", "리츠먼드" → "리치먼드"
4. 문장이 이미 정확하면 한 글자도 바꾸지 마세요.
5. 의역, 다시 쓰기, 더 자연스럽게 만들기 — 모두 금지.
6. 출력은 수정된 본문 텍스트만. 따옴표·코드 펜스·설명 절대 추가 금지.

[수정된 텍스트]`;
}
