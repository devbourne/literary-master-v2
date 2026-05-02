// v2 Phase A item 3a — Coverage Repair Agent.
// Runs after Pass 2 batches. Targets two failure modes:
//   1. missing — blockId expected but absent from any batch's response
//   2. empty   — blockId present but literary/literal fields are blank
//
// For each target, makes a single-block LLM call with prev/next context and
// the profile summary, parses the response, and inserts/replaces the block in
// the annotated array. Up to 2 retries per block. Blocks that still cannot
// be recovered are marked { partial: true, repair_reason } so the
// Finalization Gate can surface them as warnings.

import { callLLM } from "../llm";
import { buildSingleBlockPrompt } from "../prompts/block-single";
import { safeParseLLM } from "../schemas/safe-parse";
import { AnnotatedBlockSchema, type AnnotatedBlock } from "../schemas/block";

export interface CoverageRepairTarget {
  blockId: string;
  reason: "missing" | "empty";
}

export interface CoverageRepairInput {
  targets: CoverageRepairTarget[];
  /** Source-of-truth ordered block list from splitIntoBlocks(text). */
  allBlocks: { blockId: string; text: string }[];
  /** Current annotated state from Pass 2 (may be missing some blockIds). */
  annotated: AnnotatedBlock[];
  profileSummary: string;
  signal?: AbortSignal;
  /** Per-target retry budget. Defaults to 2 (so up to 3 attempts total). */
  retries?: number;
}

export interface CoverageRepairOutcome {
  blockId: string;
  reason: "missing" | "empty";
  /** Number of LLM attempts spent on this block. */
  attempts: number;
  /** Final disposition. */
  result: "repaired" | "partial";
  /** Human-readable explanation if result === "partial". */
  failureReason?: string;
}

export interface CoverageRepairResult {
  /** Updated annotated array — repaired blocks inserted/replaced, ordered by allBlocks. */
  annotated: AnnotatedBlock[];
  outcomes: CoverageRepairOutcome[];
  tokens: number;
  timeS: number;
}

export type CoverageRepairStep = {
  blockId: string;
  reason: "missing" | "empty";
  attempt: number;
  status: "start" | "success" | "retry" | "partial";
  detail?: string;
};

const FALLBACK_ANNOTATIONS = {
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
  ambiguity_level: "low" as const,
  translation_difficulty: "low" as const,
  flag_for_revision: false,
  flag_reason: "",
};

export async function runCoverageRepairAgent(
  input: CoverageRepairInput,
  onStep?: (s: CoverageRepairStep) => void,
): Promise<CoverageRepairResult> {
  const t0 = Date.now();
  // Default retry budget reduced from 2 to 1 for production budget compliance.
  // Caller can still override (input.retries) when running in "publication
  // grade" mode where the extra recovery rate is worth the wall-clock.
  const retries = input.retries ?? 1;
  const maxAttempts = retries + 1;
  let tokens = 0;

  // Build a quick lookup for the source-of-truth order/text.
  const blockIndex = new Map<string, number>();
  input.allBlocks.forEach((b, idx) => blockIndex.set(b.blockId, idx));

  // Working map keyed by blockId so we can insert/replace easily.
  const byId = new Map<string, AnnotatedBlock>();
  for (const b of input.annotated) {
    if (b.blockId) byId.set(b.blockId, b);
  }

  const outcomes: CoverageRepairOutcome[] = [];

  for (const target of input.targets) {
    const sourceBlock = input.allBlocks.find((b) => b.blockId === target.blockId);
    if (!sourceBlock) {
      // Source block id wasn't in the original split — nothing we can do.
      outcomes.push({
        blockId: target.blockId,
        reason: target.reason,
        attempts: 0,
        result: "partial",
        failureReason: "blockId not present in source split",
      });
      continue;
    }

    // Find prev/next from the working map (use whatever was salvaged).
    const idx = blockIndex.get(target.blockId) ?? -1;
    const prevBlock =
      idx > 0
        ? byId.get(input.allBlocks[idx - 1].blockId)
        : undefined;
    const nextBlock =
      idx >= 0 && idx < input.allBlocks.length - 1
        ? byId.get(input.allBlocks[idx + 1].blockId)
        : undefined;

    let attempts = 0;
    let lastFailureReason: string | undefined;
    let succeeded = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attempts = attempt;
      onStep?.({
        blockId: target.blockId,
        reason: target.reason,
        attempt,
        status: attempt === 1 ? "start" : "retry",
      });

      const prompt = buildSingleBlockPrompt({
        profileSummary: input.profileSummary,
        prevBlock: prevBlock
          ? {
              originalText: prevBlock.originalText,
              literary: prevBlock.literary_translation,
              literal: prevBlock.literal_translation,
            }
          : undefined,
        nextBlock: nextBlock
          ? {
              originalText: nextBlock.originalText,
              literary: nextBlock.literary_translation,
              literal: nextBlock.literal_translation,
            }
          : undefined,
        target: { blockId: target.blockId, originalText: sourceBlock.text },
        reason: target.reason,
      });

      const res = await callLLM(prompt, 1500, input.signal);
      tokens += res.usage.completionTokens;

      const parsed = safeParseLLM(
        AnnotatedBlockSchema,
        res.text,
        `CoverageRepair ${target.blockId} attempt ${attempt}`,
      );

      if (!parsed.ok) {
        lastFailureReason = "LLM JSON parse failed";
        continue;
      }

      const block = parsed.data;
      // Ensure required fields are populated; the agent's prompt may not always succeed.
      if (
        !block.literary_translation?.trim() ||
        !block.literal_translation?.trim()
      ) {
        lastFailureReason = "literary or literal translation still empty";
        continue;
      }

      // Force the canonical blockId/originalText (LLM may hallucinate).
      block.blockId = target.blockId;
      block.originalText = sourceBlock.text;
      // Ensure annotations exist (schema defaults usually cover this but belt+suspenders).
      if (!block.annotations) {
        block.annotations = { ...FALLBACK_ANNOTATIONS };
      }

      byId.set(target.blockId, block);
      succeeded = true;
      onStep?.({
        blockId: target.blockId,
        reason: target.reason,
        attempt,
        status: "success",
      });
      break;
    }

    if (!succeeded) {
      // Mark partial so the Finalization Gate can include it in warnings.
      const stub: AnnotatedBlock =
        byId.get(target.blockId) ?? {
          blockId: target.blockId,
          originalText: sourceBlock.text,
          literary_translation: "",
          literal_translation: "",
          korean_commentary: "",
          annotations: { ...FALLBACK_ANNOTATIONS },
        };
      stub.partial = true;
      stub.repair_reason = lastFailureReason ?? "repair exhausted retries";
      byId.set(target.blockId, stub);
      onStep?.({
        blockId: target.blockId,
        reason: target.reason,
        attempt: attempts,
        status: "partial",
        detail: stub.repair_reason,
      });
    }

    outcomes.push({
      blockId: target.blockId,
      reason: target.reason,
      attempts,
      result: succeeded ? "repaired" : "partial",
      failureReason: succeeded ? undefined : lastFailureReason,
    });
  }

  // Re-emit annotated in source-of-truth order so the assembled output reads correctly.
  const finalAnnotated: AnnotatedBlock[] = [];
  for (const b of input.allBlocks) {
    const got = byId.get(b.blockId);
    if (got) finalAnnotated.push(got);
  }

  return {
    annotated: finalAnnotated,
    outcomes,
    tokens,
    timeS: (Date.now() - t0) / 1000,
  };
}
