// v2 Phase A item 3a — single-block repair prompt for the Coverage Repair Agent.
// Used when the normal batch path either dropped a blockId entirely (missing) or
// returned it with empty literary/literal text. The agent calls this prompt with
// the surrounding context so the repaired block stays continuous with the rest.

export interface SingleBlockPromptInput {
  profileSummary: string;
  /** Blocks immediately before/after the target, used for tone/continuity. */
  prevBlock?: { originalText: string; literary: string; literal: string };
  nextBlock?: { originalText: string; literary: string; literal: string };
  target: { blockId: string; originalText: string };
  /** Why the block needs repair (helps the LLM aim its output). */
  reason: "missing" | "empty";
  /** Pre-rendered glossary block (renderGlossaryForPrompt). Empty string skips. */
  glossarySection?: string;
}

export function buildSingleBlockPrompt(input: SingleBlockPromptInput): string {
  const lines: string[] = [];
  lines.push("당신은 영어 단편을 분석하는 한국어 교재 편집자입니다.");
  lines.push("");
  lines.push(
    "이전 분석 단계에서 한 블록이 정상 처리되지 못했습니다. 주변 컨텍스트를 참고하여 ",
  );
  lines.push("해당 블록 한 개만 정확히 분석해 주세요.");
  lines.push("");
  lines.push(`[이유] ${input.reason === "missing" ? "이 blockId는 결과 배열에서 누락됨" : "이 blockId의 literary/literal 필드가 비어 있었음"}`);
  lines.push("");
  lines.push("[작품 프로파일 요약]");
  lines.push(input.profileSummary);
  lines.push("");
  if (input.glossarySection && input.glossarySection.trim()) {
    lines.push(input.glossarySection);
    lines.push("");
  }
  if (input.prevBlock) {
    lines.push("[직전 블록 — 톤·맥락 참고]");
    lines.push(`원문: ${input.prevBlock.originalText}`);
    lines.push(`문학적 번역: ${input.prevBlock.literary}`);
    lines.push(`직역: ${input.prevBlock.literal}`);
    lines.push("");
  }
  lines.push("[복구할 대상 블록]");
  lines.push(`blockId: ${input.target.blockId}`);
  lines.push(`원문: ${input.target.originalText}`);
  lines.push("");
  if (input.nextBlock) {
    lines.push("[직후 블록 — 톤·맥락 참고]");
    lines.push(`원문: ${input.nextBlock.originalText}`);
    lines.push(`문학적 번역: ${input.nextBlock.literary}`);
    lines.push(`직역: ${input.nextBlock.literal}`);
    lines.push("");
  }
  lines.push("출력 규칙:");
  lines.push("- 아래 스키마에 맞춘 단일 JSON 객체 하나만 출력하세요.");
  lines.push("- 코드 펜스, 설명 문장, 다른 블록 절대 포함 금지.");
  lines.push("- annotations 객체는 모든 필수 필드 포함 (배열 비우려면 빈 배열 [], 불 boolean은 true/false).");
  lines.push("");
  lines.push("스키마:");
  lines.push("{");
  lines.push(`  "blockId": "${input.target.blockId}",`);
  lines.push('  "originalText": "...(원문)",');
  lines.push('  "literary_translation": "한국어 문학 번역",');
  lines.push('  "literal_translation": "한국어 직역",');
  lines.push('  "korean_commentary": "이 블록에 대한 한국어 해설",');
  lines.push('  "annotations": {');
  lines.push('    "containsForeshadowing": false,');
  lines.push('    "foreshadowingSetupRef": null,');
  lines.push('    "containsCallback": false,');
  lines.push('    "callbackRef": null,');
  lines.push('    "toneShift": null,');
  lines.push('    "sceneTransition": false,');
  lines.push('    "symbolismPresent": [],');
  lines.push('    "literaryDevices": [],');
  lines.push('    "culturalReferences": [],');
  lines.push('    "key_vocabulary": [],');
  lines.push('    "notable_quote": null,');
  lines.push('    "dialogueSpeaker": null,');
  lines.push('    "ambiguity_level": "low",');
  lines.push('    "translation_difficulty": "low",');
  lines.push('    "flag_for_revision": false,');
  lines.push('    "flag_reason": ""');
  lines.push("  }");
  lines.push("}");
  return lines.join("\n");
}
