import { z } from "zod";

export const CharacterSchema = z.object({
  name: z.string().default(""),
  role: z.string().default("supporting"),
  arc_start: z.string().default(""),
  arc_middle: z.string().default(""),
  arc_end: z.string().default(""),
  defining_traits: z.array(z.string()).default([]),
  key_quotes: z.array(
    z.object({
      quote: z.string().default(""),
      significance: z.string().default(""),
    }).passthrough()
  ).default([]),
}).passthrough();

export const SymbolismSchema = z.object({
  symbol: z.string().default(""),
  meaning: z.string().default(""),
  appearances: z.array(z.string()).default([]),
}).passthrough();

export const ForeshadowingSchema = z.object({
  setup: z.string().default(""),
  setupLocation: z.string().default(""),
  resolution: z.string().default(""),
  effect: z.string().default(""),
}).passthrough();

export const PlotStageSchema = z.object({
  stage: z.string().default(""),
  summary: z.string().default(""),
  evidence_quote: z.string().default(""),
}).passthrough();

export const TwistSchema = z.object({
  what: z.string().default(""),
  setup: z.string().default(""),
  payoff: z.string().default(""),
  irony_direction: z.string().default(""),
  comparison: z.string().default(""),
}).passthrough();

export const AuthorStyleSchema = z.object({
  narration: z.string().default(""),
  dialect_register: z.string().default(""),
  humor_devices: z.array(z.string()).default([]),
  notable_passages: z.array(
    z.object({
      quote: z.string().default(""),
      device: z.string().default(""),
    }).passthrough()
  ).default([]),
}).passthrough();

export const CulturalContextSchema = z.object({
  era_background: z.array(z.string()).default([]),
  references: z.array(
    z.object({
      term: z.string().default(""),
      explanation_ko: z.string().default(""),
    }).passthrough()
  ).default([]),
}).passthrough();

export const KoreanBriefSchema = z.object({
  theme_ko: z.string().default(""),
  message_ko: z.string().default(""),
}).passthrough();

export const MetaSchema = z.object({
  genre: z.string().default(""),
  era: z.string().default(""),
  length_category: z.string().default("short"),
  language: z.string().default("en"),
}).passthrough();

export const WorkProfileSchema = z.object({
  title: z.string().default("Untitled"),
  author: z.string().default("(추정 불가)"),
  meta: MetaSchema.default({ genre: "", era: "", length_category: "short", language: "en" }),
  themes: z.array(z.string()).default([]),
  motifs: z.array(z.string()).default([]),
  characters: z.array(CharacterSchema).default([]),
  symbolism: z.array(SymbolismSchema).default([]),
  foreshadowing: z.array(ForeshadowingSchema).default([]),
  plotStructure: z.array(PlotStageSchema).default([]),
  tone_overall: z.string().default(""),
  tone_flow_summary: z.string().default(""),
  author_style: AuthorStyleSchema.default({
    narration: "",
    dialect_register: "",
    humor_devices: [],
    notable_passages: [],
  }),
  twist: TwistSchema.default({
    what: "",
    setup: "",
    payoff: "",
    irony_direction: "",
    comparison: "",
  }),
  cultural_context: CulturalContextSchema.default({
    era_background: [],
    references: [],
  }),
  korean_brief: KoreanBriefSchema.default({ theme_ko: "", message_ko: "" }),
}).passthrough();

export type WorkProfile = z.infer<typeof WorkProfileSchema>;
export type Character = z.infer<typeof CharacterSchema>;
export type Symbolism = z.infer<typeof SymbolismSchema>;
export type Foreshadowing = z.infer<typeof ForeshadowingSchema>;
export type PlotStage = z.infer<typeof PlotStageSchema>;
export type Twist = z.infer<typeof TwistSchema>;
