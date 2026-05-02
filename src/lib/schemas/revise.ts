// v2 Phase C — Pass 3 Revise output schema.
// Replaces the orchestrator's loose JSON.parse with a typed safeParseLLM target.

import { z } from "zod";

export const ReviseSchema = z
  .object({
    revised_literary_translation: z.string().default(""),
    revised_literal_translation: z.string().default(""),
    revision_reason: z.string().default(""),
    changes_significant: z.boolean().default(true),
  })
  .passthrough();

export type Revise = z.infer<typeof ReviseSchema>;
