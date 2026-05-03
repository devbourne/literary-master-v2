import { z } from "zod";

export const QuotePairSchema = z
  .object({
    en: z.string().default(""),
    ko: z.string().default(""),
  })
  .passthrough();

export const AnnotatedQuoteSchema = z
  .object({
    en: z.string().default(""),
    ko: z.string().default(""),
    note_ko: z.string().default(""),
  })
  .passthrough();

export const CharacterReadingSchema = z
  .object({
    name: z.string().default(""),
    reading_ko: z.string().default(""),
    key_quote: AnnotatedQuoteSchema.optional(),
  })
  .passthrough();

export const SymbolReadingSchema = z
  .object({
    symbol: z.string().default(""),
    reading_ko: z.string().default(""),
    evidence: QuotePairSchema.optional(),
  })
  .passthrough();

export const TwistReadingSchema = z
  .object({
    thesis_ko: z.string().default(""),
    irony_direction_ko: z.string().default(""),
    comparison_ko: z.string().default(""),
    setup_moments: z.array(AnnotatedQuoteSchema).default([]),
    payoff_moments: z.array(AnnotatedQuoteSchema).default([]),
  })
  .passthrough();

// v2.5 Multi-perspective synthesis structures.
// Populated only when the Multi-Gloss layer ran; remain empty/default
// otherwise (backwards compatible with v2 saved files).

export const ComplementaryInsightSchema = z
  .object({
    angle_pair: z.string().default(""),
    insight_ko: z.string().default(""),
  })
  .passthrough();

export const UnresolvedTensionSchema = z
  .object({
    description_ko: z.string().default(""),
    most_defensible_ko: z.string().default(""),
  })
  .passthrough();

export const PedagogicalScaffoldingSchema = z
  .object({
    cultural_pitfalls_ko: z.string().default(""),
    korean_literature_parallels_ko: z.string().default(""),
    discussion_questions_ko: z.array(z.string()).default([]),
  })
  .passthrough();

export const SynthesisSchema = z
  .object({
    thesis_ko: z.string().default(""),
    overview_essay_ko: z.string().default(""),
    character_readings: z.array(CharacterReadingSchema).default([]),
    plot_reading_ko: z.string().default(""),
    twist_reading: TwistReadingSchema.default({
      thesis_ko: "",
      irony_direction_ko: "",
      comparison_ko: "",
      setup_moments: [],
      payoff_moments: [],
    }),
    symbolism_readings: z.array(SymbolReadingSchema).default([]),
    tone_flow_ko: z.string().default(""),
    style_essay_ko: z.string().default(""),
    cultural_notes_ko: z.string().default(""),
    reading_guide_ko: z.array(z.string()).default([]),
    closing_note_ko: z.string().default(""),

    // v2.5 Multi-perspective fields. Empty when MULTI_GLOSS=false or absent.
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

export type Synthesis = z.infer<typeof SynthesisSchema>;
export type QuotePair = z.infer<typeof QuotePairSchema>;
export type AnnotatedQuote = z.infer<typeof AnnotatedQuoteSchema>;
export type CharacterReading = z.infer<typeof CharacterReadingSchema>;
export type SymbolReading = z.infer<typeof SymbolReadingSchema>;
export type TwistReading = z.infer<typeof TwistReadingSchema>;
export type ComplementaryInsight = z.infer<typeof ComplementaryInsightSchema>;
export type UnresolvedTension = z.infer<typeof UnresolvedTensionSchema>;
export type PedagogicalScaffolding = z.infer<typeof PedagogicalScaffoldingSchema>;
