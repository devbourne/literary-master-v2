import { z } from "zod";
import { WorkProfileSchema } from "./profile";
import { AnnotatedBlockSchema } from "./block";
import { SynthesisSchema } from "./synthesis";

export const VerificationIssueSchema = z.object({
  section: z.string().default(""),
  description: z.string().default(""),
  suggested_fix: z.string().optional(),
}).passthrough();

export const VerificationStatus = z.enum(["VERIFIED", "CORRECTION", "UNCERTAIN"]);

export const VerificationSchema = z.object({
  status: VerificationStatus.default("UNCERTAIN"),
  verified: z.boolean().default(false),
  correction_note: z.string().optional(),
  issues: z.array(VerificationIssueSchema).default([]),
  iterations: z.number().default(1),
}).passthrough();

export const StepStatSchema = z.object({
  step: z.union([z.number(), z.string()]).default(""),
  label: z.string().default(""),
  tokens: z.number().default(0),
  timeS: z.number().default(0),
  tokS: z.number().default(0),
}).passthrough();

export const PipelineStatsSchema = z.object({
  totalTokens: z.number().default(0),
  totalTimeS: z.number().default(0),
  avgTokS: z.number().default(0),
  steps: z.array(StepStatSchema).default([]),
}).passthrough();

export const SourcesSchema = z.object({
  raw_text: z.string().default(""),
  analyzed_text: z.string().default(""),
  source_url: z.string().optional(),
  source_title: z.string().optional(),
  piece_title: z.string().optional(),
  piece_index: z.number().optional(),
  imported_at: z.string().default(""),
}).passthrough();

export const TeachingMaterialSchema = z.object({
  schema_version: z.literal("2.0").default("2.0"),
  metadata: z.object({
    title: z.string().default("Untitled"),
    author: z.string().default("(추정 불가)"),
    source: z.string().optional(),
    generated_at: z.string().default(""),
    model_used: z.string().default(""),
    tokens_used: z.number().default(0),
    generation_time_s: z.number().default(0),
  }).passthrough().default({
    title: "Untitled",
    author: "(추정 불가)",
    generated_at: "",
    model_used: "",
    tokens_used: 0,
    generation_time_s: 0,
  }),
  profile: WorkProfileSchema,
  blocks: z.array(AnnotatedBlockSchema).default([]),
  synthesis: SynthesisSchema.optional(),
  synthesis_markdown: z.string().default(""),
  verification: VerificationSchema.default({
    status: "UNCERTAIN",
    verified: false,
    issues: [],
    iterations: 1,
  }),
  stats: PipelineStatsSchema.optional(),
  sources: SourcesSchema.optional(),
  adapter_outputs: z.record(z.string(), z.unknown()).default({}),
}).passthrough();

export type TeachingMaterial = z.infer<typeof TeachingMaterialSchema>;
export type PipelineStats = z.infer<typeof PipelineStatsSchema>;
export type StepStat = z.infer<typeof StepStatSchema>;
export type Sources = z.infer<typeof SourcesSchema>;
