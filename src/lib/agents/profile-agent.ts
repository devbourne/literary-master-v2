// v2 Phase B item 1 — Profile Agent.
//
// Routes the Pass 1 profile build by source-text length:
//   - < 30 000 chars  → "single-shot": one buildProfilePrompt call (legacy path)
//   - 30k-80k         → "samples":      head 8k + mid 8k + tail 8k partial profiles → merge
//   - > 80 000        → "chunk-merge":  N × 20k char windows → partial profiles → merge
//
// Goal: keep Pass 1 within Ollama's effective context window for the configured
// model (32k default) while preserving twist/ending fidelity via prompt rules
// in the merge step (see profile-merge.ts).

import { callLLM } from "../llm";
import { callLLMWithJsonFallback } from "../llm-fallback";
import { buildProfilePrompt } from "../prompts/profile";
import { buildProfilePartialPrompt } from "../prompts/profile-partial";
import { buildProfileMergePrompt } from "../prompts/profile-merge";
import { safeParseLLM } from "../schemas/safe-parse";
import { WorkProfileSchema, type WorkProfile } from "../schemas/profile";

export type ProfileStrategy = "single-shot" | "samples" | "chunk-merge";

const SAMPLES_THRESHOLD_CHARS = 30_000;
const CHUNK_MERGE_THRESHOLD_CHARS = 80_000;
const SAMPLE_WINDOW_CHARS = 8_000;
const CHUNK_WINDOW_CHARS = 20_000;

export interface ProfileAgentInput {
  text: string;
  signal?: AbortSignal;
}

export interface ProfileAgentResult {
  profile: WorkProfile;
  /** True when the FINAL parse (single-shot or merge) succeeded against schema. */
  parseOk: boolean;
  strategy: ProfileStrategy;
  /** How many partial profile calls were issued (0 for single-shot). */
  partialCount: number;
  tokens: number;
  timeS: number;
  /** Per-step diagnostics, useful for ops/log review. */
  steps: ProfileAgentStep[];
}

export type ProfileAgentStep = {
  kind: "single-shot" | "partial" | "merge";
  label: string;
  parseOk: boolean;
  tokens: number;
};

export function selectProfileStrategy(charCount: number): ProfileStrategy {
  if (charCount < SAMPLES_THRESHOLD_CHARS) return "single-shot";
  if (charCount < CHUNK_MERGE_THRESHOLD_CHARS) return "samples";
  return "chunk-merge";
}

export async function runProfileAgent(
  input: ProfileAgentInput,
): Promise<ProfileAgentResult> {
  const t0 = Date.now();
  const strategy = selectProfileStrategy(input.text.length);

  if (strategy === "single-shot") {
    return runSingleShot(input, t0);
  }

  // Build windows
  const windows =
    strategy === "samples"
      ? buildSampleWindows(input.text)
      : buildChunkWindows(input.text);

  return runPartialThenMerge(input, t0, strategy, windows);
}

async function runSingleShot(
  input: ProfileAgentInput,
  t0: number,
): Promise<ProfileAgentResult> {
  const res = await callLLM(buildProfilePrompt(input.text), 5000, input.signal);
  const parsed = safeParseLLM(WorkProfileSchema, res.text, "Profile single-shot");
  return {
    profile: parsed.data,
    parseOk: parsed.ok,
    strategy: "single-shot",
    partialCount: 0,
    tokens: res.usage.completionTokens,
    timeS: (Date.now() - t0) / 1000,
    steps: [
      {
        kind: "single-shot",
        label: "single-shot profile",
        parseOk: parsed.ok,
        tokens: res.usage.completionTokens,
      },
    ],
  };
}

interface ProfileWindow {
  label: string;
  description: string;
  text: string;
}

function buildSampleWindows(text: string): ProfileWindow[] {
  const len = text.length;
  const win = SAMPLE_WINDOW_CHARS;
  const head = text.slice(0, win);
  const mid = text.slice(
    Math.max(0, Math.floor(len / 2) - Math.floor(win / 2)),
    Math.max(win, Math.floor(len / 2) + Math.ceil(win / 2)),
  );
  const tail = text.slice(Math.max(0, len - win));
  return [
    {
      label: "head",
      description: `처음 ${head.length.toLocaleString()}자 (도입부)`,
      text: head,
    },
    {
      label: "mid",
      description: `중반 ${mid.length.toLocaleString()}자`,
      text: mid,
    },
    {
      label: "tail",
      description: `끝 ${tail.length.toLocaleString()}자 (결말 포함)`,
      text: tail,
    },
  ];
}

function buildChunkWindows(text: string): ProfileWindow[] {
  const windows: ProfileWindow[] = [];
  const total = text.length;
  let start = 0;
  let idx = 0;
  const expectedChunks = Math.max(1, Math.ceil(total / CHUNK_WINDOW_CHARS));
  while (start < total) {
    const end = Math.min(total, start + CHUNK_WINDOW_CHARS);
    const chunk = text.slice(start, end);
    idx++;
    windows.push({
      label: `chunk ${idx}/${expectedChunks}`,
      description: `${start.toLocaleString()}~${end.toLocaleString()}자`,
      text: chunk,
    });
    start = end;
  }
  return windows;
}

async function runPartialThenMerge(
  input: ProfileAgentInput,
  t0: number,
  strategy: Exclude<ProfileStrategy, "single-shot">,
  windows: ProfileWindow[],
): Promise<ProfileAgentResult> {
  const totalChars = input.text.length;
  const steps: ProfileAgentStep[] = [];
  const partialJsons: string[] = [];
  let tokens = 0;

  // Sequential: Ollama serializes per-model anyway, so parallel buys little
  // and uses more memory; sequential keeps logs readable.
  for (const win of windows) {
    if (input.signal?.aborted) {
      throw new DOMException(
        `profile-agent aborted at partial ${win.label}`,
        "AbortError",
      );
    }
    const res = await callLLM(
      buildProfilePartialPrompt({
        windowLabel: win.label,
        windowDescription: win.description,
        windowText: win.text,
        totalChars,
      }),
      4000,
      input.signal,
    );
    tokens += res.usage.completionTokens;
    // Validate so the merge step receives clean inputs even when one partial
    // is malformed. We schema-parse but keep the raw too — the merger sees
    // whatever JSON we have (parsed.data is the schema-defaulted version).
    const parsed = safeParseLLM(
      WorkProfileSchema,
      res.text,
      `Profile partial ${win.label}`,
    );
    partialJsons.push(JSON.stringify(parsed.data));
    steps.push({
      kind: "partial",
      label: `partial: ${win.label}`,
      parseOk: parsed.ok,
      tokens: res.usage.completionTokens,
    });
  }

  // Merge call — wrapped in JSON fallback (Phase F-1) since structural
  // integrity here is critical: a malformed merge propagates a junk profile
  // into every downstream stage.
  if (input.signal?.aborted) {
    throw new DOMException("profile-agent aborted before merge", "AbortError");
  }
  const merged = await callLLMWithJsonFallback(
    buildProfileMergePrompt({
      partialProfilesJson: `[${partialJsons.join(",\n")}]`,
      partialCount: partialJsons.length,
      strategy,
      totalChars,
    }),
    WorkProfileSchema,
    {
      maxTokens: 6000,
      signal: input.signal,
      label: "Profile merge",
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
    profile: merged.data,
    parseOk: merged.ok,
    strategy,
    partialCount: windows.length,
    tokens,
    timeS: (Date.now() - t0) / 1000,
    steps,
  };
}
