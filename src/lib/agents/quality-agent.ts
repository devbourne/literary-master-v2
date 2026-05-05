// v2 Phase C — Quality Agent.
//
// Replaces the v1 Pass 3 logic
//   `if (flagged.length > 0 && flagged.length < annotated.length * 0.5)` …
// which was anti-quality (skipped revise precisely when output was worst).
//
// Ratio-banded dispatch:
//   - flagged ratio < 30%        → "low":    revise every flagged block (legacy intent)
//   - 30% ≤ ratio < 80%          → "medium": revise every flagged block + emit a
//                                              gate signal so the Finalization Gate can
//                                              warn about systemic quality drift
//   - ratio ≥ 80%                → "high":   identify failing batches (>60% of blocks
//                                              flagged), retry each batch ONCE, then
//                                              recompute. Revise the (hopefully smaller)
//                                              flagged set on the post-retry annotated
//
// Also swaps the loose JSON.parse for safeParseLLM(ReviseSchema) so revise output
// participates in the same fallback bookkeeping as everything else.

import { callLLM } from "../llm";
import { buildBlockBatchPrompt } from "../prompts/block-batch";
import { buildRevisePrompt } from "../prompts/pass3-revise";
import { safeParseLLM } from "../schemas/safe-parse";
import { BatchResponseSchema, type AnnotatedBlock } from "../schemas/block";
import { ReviseSchema } from "../schemas/revise";
import {
  formatPreviousTranslations,
  truncate,
} from "../pipeline/batcher";

export type QualityBand = "low" | "medium" | "high";

export interface BlockBatch {
  blockId: string;
  text: string;
}

export interface QualityAgentInput {
  /** Mutated in place. After the call, returned in result for clarity. */
  annotated: AnnotatedBlock[];
  /** Original Pass 2 batches (used for batch retry in the high band). */
  batches: BlockBatch[][];
  profileSummary: string;
  /** Best-available rolling summary (final from Pass 2). */
  rollingSummary: string;
  /** Pre-rendered glossary block; injected into the high-band batch retry
   *  prompt so retried batches keep proper-noun spellings consistent with
   *  the rest of the run. */
  glossarySection?: string;
  signal?: AbortSignal;
}

export interface QualityAgentResult {
  annotated: AnnotatedBlock[];
  band: QualityBand;
  flaggedRatioBefore: number;
  flaggedRatioAfter: number;
  retriedBatchIndices: number[];
  revisedCount: number;
  /** Number of revise/batch-retry parses that fell back. */
  fallbackCount: number;
  tokens: number;
  timeS: number;
}

const HIGH_BAND_THRESHOLD = 0.8;
const MEDIUM_BAND_THRESHOLD = 0.3;
const FAILING_BATCH_THRESHOLD = 0.6;

function computeRatio(blocks: AnnotatedBlock[]): number {
  if (blocks.length === 0) return 0;
  const flagged = blocks.filter((b) => b.annotations?.flag_for_revision).length;
  return flagged / blocks.length;
}

function failingBatchIndices(
  annotated: AnnotatedBlock[],
  batches: BlockBatch[][],
): number[] {
  const byId = new Map<string, AnnotatedBlock>();
  for (const b of annotated) {
    if (b.blockId) byId.set(b.blockId, b);
  }
  const failing: number[] = [];
  for (let i = 0; i < batches.length; i++) {
    const blocksInBatch = batches[i]
      .map((b) => byId.get(b.blockId))
      .filter((b): b is AnnotatedBlock => !!b);
    if (blocksInBatch.length === 0) continue;
    const ratio =
      blocksInBatch.filter((b) => b.annotations?.flag_for_revision).length /
      blocksInBatch.length;
    if (ratio >= FAILING_BATCH_THRESHOLD) failing.push(i);
  }
  return failing;
}

export async function runQualityAgent(
  input: QualityAgentInput,
): Promise<QualityAgentResult> {
  const t0 = Date.now();
  let tokens = 0;
  let fallbackCount = 0;
  let revisedCount = 0;

  const flaggedRatioBefore = computeRatio(input.annotated);
  let band: QualityBand = "low";
  if (flaggedRatioBefore >= HIGH_BAND_THRESHOLD) band = "high";
  else if (flaggedRatioBefore >= MEDIUM_BAND_THRESHOLD) band = "medium";

  const retriedBatchIndices: number[] = [];

  // ── high band: retry failing batches once before revise ──
  if (band === "high") {
    const failing = failingBatchIndices(input.annotated, input.batches);
    for (const idx of failing) {
      if (input.signal?.aborted) {
        throw new DOMException(
          `quality-agent aborted at batch retry ${idx}`,
          "AbortError",
        );
      }
      const prompt = buildBlockBatchPrompt({
        profileSummary: input.profileSummary,
        rollingSummary: input.rollingSummary,
        previousTranslations: formatPreviousTranslations(input.annotated, 2),
        batchIndex: idx,
        totalBatches: input.batches.length,
        blocks: input.batches[idx],
        glossarySection: input.glossarySection,
      });
      const res = await callLLM(prompt, 4000, input.signal);
      tokens += res.usage.completionTokens;
      const parsed = safeParseLLM(
        BatchResponseSchema,
        res.text,
        `QualityAgent retry batch ${idx}`,
      );
      if (!parsed.ok) {
        fallbackCount++;
        continue;
      }
      const expected = new Set(input.batches[idx].map((b) => b.blockId));
      const newBlocks = parsed.data.translations.filter(
        (t) => t.blockId && expected.has(t.blockId),
      );
      if (newBlocks.length === 0) continue;
      // Replace blocks in annotated array, preserving order
      const newById = new Map<string, AnnotatedBlock>();
      const sourceById = new Map(input.batches[idx].map((b) => [b.blockId, b.text]));
      for (const tr of newBlocks) {
        if (!tr.originalText) tr.originalText = sourceById.get(tr.blockId) || "";
        newById.set(tr.blockId, tr);
      }
      for (let j = 0; j < input.annotated.length; j++) {
        const replacement = newById.get(input.annotated[j].blockId);
        if (replacement) input.annotated[j] = replacement;
      }
      retriedBatchIndices.push(idx);
    }
  }

  // ── revise loop ──
  // Recompute flagged AFTER any retries so high-band sees the post-retry state.
  const flaggedAfterRetry = input.annotated.filter(
    (b) => b.annotations?.flag_for_revision,
  );

  for (const b of flaggedAfterRetry) {
    if (input.signal?.aborted) {
      throw new DOMException("quality-agent aborted at revise", "AbortError");
    }
    const idx = input.annotated.findIndex((x) => x.blockId === b.blockId);
    if (idx < 0) continue;
    const prompt = buildRevisePrompt({
      profileSummary: input.profileSummary,
      fullRollingSummary: input.rollingSummary,
      flaggedBlock: {
        blockId: b.blockId,
        originalText: b.originalText,
        previousTranslation: {
          literary: b.literary_translation,
          literal: b.literal_translation,
        },
        flagReason: b.annotations.flag_reason,
      },
      neighbors: {
        before: input.annotated[idx - 1]?.literary_translation,
        after: input.annotated[idx + 1]?.literary_translation,
      },
    });
    const res = await callLLM(prompt, 1500, input.signal);
    tokens += res.usage.completionTokens;
    const parsed = safeParseLLM(
      ReviseSchema,
      res.text,
      `QualityAgent revise ${b.blockId}`,
    );
    if (!parsed.ok) {
      fallbackCount++;
      continue;
    }
    const data = parsed.data;
    if (data.changes_significant !== false) {
      input.annotated[idx].revised_literary_translation =
        data.revised_literary_translation;
      input.annotated[idx].revised_literal_translation =
        data.revised_literal_translation;
      input.annotated[idx].revision_reason = data.revision_reason;
      // Clear the original flag so flaggedRatioAfter reflects unresolved
      // issues, not historical "this needed revising" markers. Without this
      // the gate's qualityFlaggedRatioAfter equals flaggedRatioBefore even
      // when revise succeeded on every block.
      const ann = input.annotated[idx].annotations;
      if (ann) {
        ann.flag_for_revision = false;
        ann.flag_reason = "";
      }
      revisedCount++;
    }
  }

  // Truncate the rolling summary just to keep it within batch defaults if it grew.
  // (Pure formatting hygiene; not strictly necessary here.)
  void truncate(input.rollingSummary, 1500);

  return {
    annotated: input.annotated,
    band,
    flaggedRatioBefore,
    flaggedRatioAfter: computeRatio(input.annotated),
    retriedBatchIndices,
    revisedCount,
    fallbackCount,
    tokens,
    timeS: (Date.now() - t0) / 1000,
  };
}
