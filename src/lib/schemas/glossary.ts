// v2.5 Track C — Proper Noun Glossary schema.
// Output of the Glossary stage: a canonical English→Korean mapping for the
// work's proper nouns, injected into block-batch prompts so per-block calls
// don't independently mistranslate names (e.g. "Magi" → "마귀" instead of "마기").

import { z } from "zod";

export const GlossaryEntrySchema = z
  .object({
    english: z.string().default(""),
    korean: z.string().default(""),
    /** Helps the LLM disambiguate (e.g. "Magi" type=concept_religious vs name). */
    type: z
      .enum(["person", "place", "work_title", "concept", "object", "other"])
      .default("other"),
    /** Short Korean note clarifying meaning when not obvious from name. */
    note_ko: z.string().optional(),
  })
  .passthrough();

export const GlossarySchema = z
  .object({
    entries: z.array(GlossaryEntrySchema).default([]),
  })
  .passthrough();

export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;
export type Glossary = z.infer<typeof GlossarySchema>;

/** Render a glossary as the prompt-ready text block injected into batch prompts. */
export function renderGlossaryForPrompt(glossary: Glossary): string {
  if (!glossary.entries || glossary.entries.length === 0) return "";
  const lines: string[] = ["## 고유명사 한국어 표기 (반드시 따를 것)"];
  for (const e of glossary.entries) {
    if (!e.english || !e.korean) continue;
    const note = e.note_ko ? ` — ${e.note_ko}` : "";
    lines.push(`- "${e.english}" → "${e.korean}"${note}`);
  }
  lines.push(
    "",
    "위 표기를 어기지 마세요. 글로서리에 없는 고유명사는 추론하되 일관성 유지.",
  );
  return lines.join("\n");
}
