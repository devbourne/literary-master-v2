// v2 Phase B item 2 — Synthesis Agent (length-routing strategy).
//
// Routes the Synthesis stage by annotated block count:
//   - blocks < 150  → "single-shot": one buildSynthesisPromptV2 call (legacy path,
//                     streamed for status-tick UX)
//   - blocks ≥ 150  → "chunk-merge": split block summaries into N chunks,
//                     mini-synthesis per chunk, merge into canonical Synthesis
//
// Same architectural pattern as profile-agent. Conflict-resolution rules live
// in synthesis-merge.ts.

import { callLLM, streamLLMChunks } from "../llm";
import { callLLMWithJsonFallback } from "../llm-fallback";
import { buildSynthesisPromptV2 } from "../prompts/synthesis";
import { buildSynthesisPartialPrompt } from "../prompts/synthesis-partial";
import { buildSynthesisMergePrompt } from "../prompts/synthesis-merge";
import { safeParseLLM } from "../schemas/safe-parse";
import { SynthesisSchema, type Synthesis } from "../schemas/synthesis";
import type { WorkProfile } from "../schemas/profile";
import type { AnnotatedBlock } from "../schemas/block";

export type SynthesisStrategy = "single-shot" | "chunk-merge";

const CHUNK_MERGE_THRESHOLD_BLOCKS = 150;
const CHUNK_TARGET_BLOCKS = 80;

export interface SynthesisAgentInput {
  profile: WorkProfile;
  annotated: AnnotatedBlock[];
  /** Same fn that orchestrator uses to compress blocks for synthesis input. */
  summarizeBlocks: (blocks: AnnotatedBlock[]) => string;
  signal?: AbortSignal;
  /** Optional progress callback, invoked at strategic points. Mirrors single-shot's status ticks. */
  onProgress?: (chars: number) => void;
}

export interface SynthesisAgentResult {
  synthesis: Synthesis;
  parseOk: boolean;
  strategy: SynthesisStrategy;
  partialCount: number;
  tokens: number;
  timeS: number;
  steps: SynthesisAgentStep[];
}

export type SynthesisAgentStep = {
  kind: "single-shot" | "partial" | "merge";
  label: string;
  parseOk: boolean;
  tokens: number;
};

export function selectSynthesisStrategy(
  blockCount: number,
): SynthesisStrategy {
  return blockCount < CHUNK_MERGE_THRESHOLD_BLOCKS
    ? "single-shot"
    : "chunk-merge";
}

export async function runSynthesisAgent(
  input: SynthesisAgentInput,
): Promise<SynthesisAgentResult> {
  const t0 = Date.now();
  const strategy = selectSynthesisStrategy(input.annotated.length);

  if (strategy === "single-shot") {
    return runSingleShot(input, t0);
  }
  return runChunkMerge(input, t0);
}

async function runSingleShot(
  input: SynthesisAgentInput,
  t0: number,
): Promise<SynthesisAgentResult> {
  const annotatedSummary = input.summarizeBlocks(input.annotated);
  const prompt = buildSynthesisPromptV2({
    profile: input.profile,
    annotatedSummary,
  });
  const gen = streamLLMChunks(prompt, 6000, input.signal);
  let raw = "";
  let tokens = 0;
  let lastTick = 0;
  while (true) {
    const { done, value } = await gen.next();
    if (done) {
      tokens = (value as { completionTokens: number })?.completionTokens ?? 0;
      break;
    }
    raw += value;
    if (raw.length - lastTick > 500) {
      lastTick = raw.length;
      input.onProgress?.(raw.length);
    }
  }
  const parsed = safeParseLLM(SynthesisSchema, raw, "Synthesis single-shot");
  return {
    synthesis: parsed.data,
    parseOk: parsed.ok,
    strategy: "single-shot",
    partialCount: 0,
    tokens,
    timeS: (Date.now() - t0) / 1000,
    steps: [
      {
        kind: "single-shot",
        label: "single-shot synthesis",
        parseOk: parsed.ok,
        tokens,
      },
    ],
  };
}

async function runChunkMerge(
  input: SynthesisAgentInput,
  t0: number,
): Promise<SynthesisAgentResult> {
  const total = input.annotated.length;
  const chunkSize = Math.min(
    CHUNK_TARGET_BLOCKS,
    Math.ceil(total / Math.ceil(total / CHUNK_TARGET_BLOCKS)),
  );
  const chunks: AnnotatedBlock[][] = [];
  for (let i = 0; i < total; i += chunkSize) {
    chunks.push(input.annotated.slice(i, i + chunkSize));
  }

  const steps: SynthesisAgentStep[] = [];
  const partialJsons: string[] = [];
  let tokens = 0;

  for (let i = 0; i < chunks.length; i++) {
    if (input.signal?.aborted) {
      throw new DOMException(
        `synthesis-agent aborted at partial ${i + 1}/${chunks.length}`,
        "AbortError",
      );
    }
    const summary = input.summarizeBlocks(chunks[i]);
    const partialRes = await callLLM(
      buildSynthesisPartialPrompt({
        profile: input.profile,
        chunkIndex: i + 1,
        totalChunks: chunks.length,
        annotatedSummaryChunk: summary,
      }),
      4000,
      input.signal,
    );
    tokens += partialRes.usage.completionTokens;
    const parsed = safeParseLLM(
      SynthesisSchema,
      partialRes.text,
      `Synthesis partial ${i + 1}/${chunks.length}`,
    );
    partialJsons.push(JSON.stringify(parsed.data));
    steps.push({
      kind: "partial",
      label: `partial ${i + 1}/${chunks.length}`,
      parseOk: parsed.ok,
      tokens: partialRes.usage.completionTokens,
    });
    input.onProgress?.(partialJsons.reduce((a, s) => a + s.length, 0));
  }

  if (input.signal?.aborted) {
    throw new DOMException("synthesis-agent aborted before merge", "AbortError");
  }
  // JSON fallback (Phase F-1): synthesis merge is a structural integrity
  // point — a malformed merge breaks export, PDF, and Verify v2's report.
  const merged = await callLLMWithJsonFallback(
    buildSynthesisMergePrompt({
      profile: input.profile,
      partialsJson: `[${partialJsons.join(",\n")}]`,
      partialCount: partialJsons.length,
    }),
    SynthesisSchema,
    {
      maxTokens: 7000,
      signal: input.signal,
      label: "Synthesis merge",
    },
  );
  tokens += merged.tokens;
  steps.push({
    kind: "merge",
    label: merged.usedFallback ? `merge (fallback: ${merged.modelUsed})` : "merge",
    parseOk: merged.ok,
    tokens: merged.tokens,
  });

  return {
    synthesis: merged.data,
    parseOk: merged.ok,
    strategy: "chunk-merge",
    partialCount: chunks.length,
    tokens,
    timeS: (Date.now() - t0) / 1000,
    steps,
  };
}
