// v2.5 Synthesis split — Stage 4b output schema.
// Focused on the 4 multi-perspective fields only. Keeping the schema small
// dramatically improves JSON output reliability vs cramming all 17+ fields
// into one call (proven by v2.5b/d/e/f failure pattern).

import { z } from "zod";
import {
  ComplementaryInsightSchema,
  UnresolvedTensionSchema,
  PedagogicalScaffoldingSchema,
} from "./synthesis";

export const SynthesisEnrichmentSchema = z
  .object({
    multi_perspective_synthesis_ko: z.string().default(""),
    complementary_insights: z.array(ComplementaryInsightSchema).default([]),
    unresolved_tensions: z.array(UnresolvedTensionSchema).default([]),
    pedagogical_scaffolding: PedagogicalScaffoldingSchema.default({
      cultural_pitfalls_ko: "",
      korean_literature_parallels_ko: "",
      discussion_questions_ko: [],
    }),
  })
  .passthrough();

export type SynthesisEnrichment = z.infer<typeof SynthesisEnrichmentSchema>;
