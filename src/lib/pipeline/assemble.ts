import type { WorkProfile } from "../schemas/profile";
import type { AnnotatedBlock } from "../schemas/block";
import type {
  TeachingMaterial,
  PipelineStats,
  Sources,
  VerificationIssueSchema,
} from "../schemas/teaching-material";
import type { Synthesis } from "../schemas/synthesis";
import type { z } from "zod";

type VerificationIssue = z.infer<typeof VerificationIssueSchema>;

export interface AssembleInput {
  profile: WorkProfile;
  blocks: AnnotatedBlock[];
  synthesis?: Synthesis;
  synthesisMd?: string;
  verify: {
    status: "VERIFIED" | "CORRECTION" | "UNCERTAIN";
    note?: string;
    issues?: VerificationIssue[];
    iterations?: number;
  };
  stats: PipelineStats;
  modelUsed: string;
  source?: string;
  sources?: Sources;
}

export function assemble(i: AssembleInput): TeachingMaterial {
  return {
    schema_version: "2.0",
    metadata: {
      title: i.profile.title,
      author: i.profile.author,
      source: i.source,
      generated_at: new Date().toISOString(),
      model_used: i.modelUsed,
      tokens_used: i.stats.totalTokens,
      generation_time_s: i.stats.totalTimeS,
    },
    profile: i.profile,
    blocks: i.blocks,
    synthesis: i.synthesis,
    synthesis_markdown: i.synthesisMd ?? "",
    verification: {
      status: i.verify.status,
      verified: i.verify.status === "VERIFIED",
      correction_note: i.verify.note,
      issues: i.verify.issues ?? [],
      iterations: i.verify.iterations ?? 1,
    },
    stats: i.stats,
    sources: i.sources,
    adapter_outputs: {},
  };
}
