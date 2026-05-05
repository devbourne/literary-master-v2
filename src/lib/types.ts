// Re-export Zod schema types as canonical types
export type { WorkProfile, Character, Symbolism, Foreshadowing, PlotStage, Twist } from "./schemas/profile";
export type { AnnotatedBlock, Annotation, KeyVocab, BatchResponse } from "./schemas/block";
export type { TeachingMaterial, PipelineStats, StepStat } from "./schemas/teaching-material";
export type {
  Synthesis,
  QuotePair,
  AnnotatedQuote,
  CharacterReading,
  SymbolReading,
  TwistReading,
} from "./schemas/synthesis";

import type { WorkProfile } from "./schemas/profile";
import type { AnnotatedBlock } from "./schemas/block";

export type PipelinePhase =
  | "idle"
  | "profile"
  | "blocks"
  | "revise"
  | "synthesis"
  | "verify"
  | "done";

export type PipelineEvent =
  | { type: "status"; phase: PipelinePhase; message: string }
  | { type: "profile_complete"; profile: WorkProfile }
  | {
      type: "batch_start";
      batchIndex: number;
      totalBatches: number;
      blockIds: string[];
    }
  | {
      type: "batch_complete";
      batchIndex: number;
      blocks: AnnotatedBlock[];
      rollingSummary: string;
    }
  | { type: "revise_one"; blockId: string }
  | {
      type: "agent_step";
      agent: string;
      iter: number;
      action: string;
      status?: string;
      contextChars?: number;
      issueCount?: number;
    }
  | {
      type: "verify_complete";
      verified: boolean;
      status: "VERIFIED" | "CORRECTION" | "UNCERTAIN";
      iterations: number;
      issues: { section: string; description: string; suggested_fix?: string }[];
      text: string;
    }
  | {
      type: "complete";
      storageId: string;
      warnings?: string[];
    }
  | {
      type: "complete_with_warnings";
      storageId: string;
      warnings: string[];
    }
  | {
      type: "incomplete";
      reason: string;
      retryable: boolean;
    }
  | { type: "error"; message: string };
