// v2.5 Track C — Proper Noun Glossary Agent.
//
// Runs after Profile, before Block Batches. Extracts the canonical
// English→Korean mapping for the work's proper nouns and persists them so
// every batch prompt can include the same glossary as ground truth.
//
// Single LLM call (~30-60s on gemma4). Uses the JSON-fallback wrapper since
// the schema integrity matters (a malformed glossary either replaces every
// proper noun with junk or gets dropped entirely).

import { callLLMWithJsonFallback } from "../llm-fallback";
import { buildGlossaryPrompt } from "../prompts/glossary";
import { GlossarySchema, type Glossary } from "../schemas/glossary";
import type { WorkProfile } from "../schemas/profile";

export interface GlossaryAgentInput {
  text: string;
  profile: WorkProfile;
  signal?: AbortSignal;
}

export interface GlossaryAgentResult {
  glossary: Glossary;
  parseOk: boolean;
  modelUsed: string;
  usedFallback: boolean;
  tokens: number;
  timeS: number;
}

export async function runGlossaryAgent(
  input: GlossaryAgentInput,
): Promise<GlossaryAgentResult> {
  const t0 = Date.now();
  const result = await callLLMWithJsonFallback(
    buildGlossaryPrompt({ text: input.text, profile: input.profile }),
    GlossarySchema,
    {
      maxTokens: 2000,
      signal: input.signal,
      label: "Glossary extraction",
    },
  );
  return {
    glossary: result.data,
    parseOk: result.ok,
    modelUsed: result.modelUsed,
    usedFallback: result.usedFallback,
    tokens: result.tokens,
    timeS: (Date.now() - t0) / 1000,
  };
}
