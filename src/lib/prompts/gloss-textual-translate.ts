// v2.5 Multi-Gloss Angle 1 — Korean translation of the textual gloss.
// Uses gemma4 (Korean depth). The glossary is injected so proper-noun
// translations are pinned (prevents Magi → 마귀 type drift).

export interface TextualGlossTranslatePromptInput {
  englishAnalysis: string;
  glossarySection?: string;
}

export function buildTextualGlossTranslatePrompt(
  input: TextualGlossTranslatePromptInput,
): string {
  return `당신은 영문 문학 비평을 한국어로 번역하는 전문가입니다.

## 번역 원칙
1. 문장 단위 의미 충실. 학술적 톤 유지.
2. 영어 인용구 (큰따옴표 안의 영문) 는 *원문 그대로* 두고, 그 한국어 의역을 (괄호) 안에 첨가.
3. 비평 전문 용어는 한국 학계에서 통용되는 표기 사용 (예: "ring composition" → "환형 구성/링 컴포지션").
4. **고유명사는 아래 글로서리를 반드시 따를 것**.
${input.glossarySection ? `\n${input.glossarySection}\n` : ""}

## 영문 분석 원문
${input.englishAnalysis}

## 출력
번역된 한국어 산문만 출력. 마크다운, 설명, 메타 코멘트 모두 금지.`;
}
