// v2.5 Multi-Gloss Angle 1 — Textual close-reading prompt for gpt-oss:120b.
// English output. A separate translation pass renders the Korean version.

import type { WorkProfile } from "../schemas/profile";

export interface TextualGlossPromptInput {
  text: string;
  profile: WorkProfile;
}

export function buildTextualGlossPrompt(
  input: TextualGlossPromptInput,
): string {
  const sample = input.text.slice(0, 8000);
  return `You are a literary close-reader analyzing a short piece of English fiction for a humanities seminar. Produce a focused, sentence-level analysis that captures what the text is doing rhetorically, not just what it is about.

## Source text
${sample}

## Profile (one-line context)
- Title: ${input.profile.title || "(unknown)"}
- Author: ${input.profile.author || "(unknown)"}
- Themes: ${input.profile.themes.slice(0, 3).join("; ")}

## Task

Write a SINGLE essay (300-500 words) of textual close-reading that surfaces:
1. Specific phrases / clauses doing rhetorical work (cite exact quotes)
2. Narrative voice strategies — register shifts, addresser intrusion, tonal hedging
3. Pattern-level features — repetitions, ring composition, mirroring, echoes
4. Internal tensions in the text's own logic that a careful reader should mark

Avoid:
- Plot summary (the analyst already has the plot)
- Generic theme statement (covered elsewhere)
- "This is a story about..." opening — start in the middle of a textual observation

Use the analytic vocabulary of literary close reading. Coin a memorable framing if the text invites one (in the spirit of "Compulsion Loop" or "Continuity Fallacy" — pithy, anchored to a specific phrase).

## Output

Plain English prose ONLY. No JSON, no markdown, no headers. The essay itself, ready for downstream translation.`;
}
