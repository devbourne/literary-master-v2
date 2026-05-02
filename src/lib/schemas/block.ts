import { z } from "zod";

export const KeyVocabSchema = z.object({
  en: z.string().default(""),
  pronunciation: z.string().default(""),
  part_of_speech: z.string().default(""),
  ko_gloss: z.string().default(""),
  context_note_ko: z.string().default(""),
}).passthrough();

export const LiteraryDeviceSchema = z.object({
  device: z.string().default(""),
  description_ko: z.string().default(""),
}).passthrough();

export const CulturalRefSchema = z.object({
  term: z.string().default(""),
  explanation_ko: z.string().default(""),
}).passthrough();

// symbolismPresent: can be either strings or {symbol, meaning} objects
// Accept both and normalize to string[] via preprocess
const SymbolRefSchema = z.preprocess(
  (val) => {
    if (!Array.isArray(val)) return [];
    return val.map((item) => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item !== null) {
        const o = item as Record<string, unknown>;
        return String(o.symbol || o.name || o.term || JSON.stringify(item));
      }
      return String(item);
    });
  },
  z.array(z.string()).default([]),
);

export const AnnotationSchema = z.object({
  containsForeshadowing: z.boolean().default(false),
  foreshadowingSetupRef: z.string().nullable().default(null),
  containsCallback: z.boolean().default(false),
  callbackRef: z.string().nullable().default(null),
  toneShift: z.string().nullable().default(null),
  sceneTransition: z.boolean().default(false),
  symbolismPresent: SymbolRefSchema,
  literaryDevices: z.array(LiteraryDeviceSchema).default([]),
  culturalReferences: z.array(CulturalRefSchema).default([]),
  key_vocabulary: z.array(KeyVocabSchema).default([]),
  notable_quote: z.string().nullable().default(null),
  dialogueSpeaker: z.string().nullable().default(null),
  ambiguity_level: z.string().default("low"),
  translation_difficulty: z.string().default("low"),
  flag_for_revision: z.boolean().default(false),
  flag_reason: z.string().default(""),
}).passthrough();

export const AnnotatedBlockSchema = z.object({
  blockId: z.string().default(""),
  originalText: z.string().default(""),
  literary_translation: z.string().default(""),
  literal_translation: z.string().default(""),
  korean_commentary: z.string().default(""),
  annotations: AnnotationSchema.default({
    containsForeshadowing: false,
    foreshadowingSetupRef: null,
    containsCallback: false,
    callbackRef: null,
    toneShift: null,
    sceneTransition: false,
    symbolismPresent: [],
    literaryDevices: [],
    culturalReferences: [],
    key_vocabulary: [],
    notable_quote: null,
    dialogueSpeaker: null,
    ambiguity_level: "low",
    translation_difficulty: "low",
    flag_for_revision: false,
    flag_reason: "",
  }),
  revised_literary_translation: z.string().optional(),
  revised_literal_translation: z.string().optional(),
  revision_reason: z.string().optional(),
}).passthrough();

export const BatchResponseSchema = z.object({
  translations: z.array(AnnotatedBlockSchema).default([]),
  rolling_summary_update: z.string().default(""),
}).passthrough();

export type AnnotatedBlock = z.infer<typeof AnnotatedBlockSchema>;
export type Annotation = z.infer<typeof AnnotationSchema>;
export type KeyVocab = z.infer<typeof KeyVocabSchema>;
export type BatchResponse = z.infer<typeof BatchResponseSchema>;
