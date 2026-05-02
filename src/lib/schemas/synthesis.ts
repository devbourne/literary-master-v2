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
  })
  .passthrough();

export type Synthesis = z.infer<typeof SynthesisSchema>;
export type QuotePair = z.infer<typeof QuotePairSchema>;
export type AnnotatedQuote = z.infer<typeof AnnotatedQuoteSchema>;
export type CharacterReading = z.infer<typeof CharacterReadingSchema>;
export type SymbolReading = z.infer<typeof SymbolReadingSchema>;
export type TwistReading = z.infer<typeof TwistReadingSchema>;
