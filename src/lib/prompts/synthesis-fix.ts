// v2 Phase A — Verify Agent v2 supporting prompt.
// Asks the LLM to apply a single Verify-flagged correction to the synthesis JSON,
// returning the updated JSON. Used inside verify-agent's CORRECTION loop.

export interface SynthesisFixPromptInput {
  /** Stringified synthesis JSON (the current state). */
  synthesisJson: string;
  /** Section identifier surfaced by the verify agent (e.g. "twist_reading.thesis_ko"). */
  section: string;
  /** Verify agent's description of the discrepancy. */
  description: string;
  /** Verify agent's suggested correction text. */
  suggestedFix: string;
}

export function buildSynthesisFixPrompt(input: SynthesisFixPromptInput): string {
  return `당신은 문학 분석 JSON을 정밀하게 수정하는 편집자입니다.

검증 에이전트가 분석 JSON에서 다음 문제를 발견했습니다.

[발견된 섹션]
${input.section}

[문제 설명]
${input.description}

[제안된 수정]
${input.suggestedFix}

규칙:
1. 지적된 섹션만 수정하세요. 그 외 모든 섹션은 한 글자도 바꾸지 마세요.
2. JSON 구조(필드 이름, 타입, 배열 길이)는 절대 변경하지 마세요.
3. 한국어 필드는 한국어로, 영어 필드는 영어로 유지하세요.
4. 결과는 수정된 전체 JSON 객체 하나만 출력하세요. 설명 문장이나 코드 펜스(\`\`\`)는 절대 포함하지 마세요.

[원본 JSON]
${input.synthesisJson}

[수정된 JSON]`;
}
