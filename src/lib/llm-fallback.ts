// v2 Phase F-1 — JSON Fallback wrapper.
//
// Calls the default model first. If the response fails schema parse, retries
// the SAME prompt with a fallback model (FALLBACK_MODEL env var, typically
// qwen3:30b-a3b which is the JSON-robustness keeper from our model
// evaluations). Returns whichever parse succeeded; if both fail, returns the
// default model's data (schema-defaulted) so downstream still gets something.
//
// Use this only at structural integrity points where parse failure leaves
// the pipeline broken (Profile merge, Synthesis merge, Verify status). For
// stages where a partial / fallback-defaulted shape is acceptable, the plain
// safeParseLLM is fine and avoids the extra round-trip.

import type { z } from "zod";
import { callLLM, FALLBACK_MODEL, MODEL } from "./llm";
import { safeParseLLM } from "./schemas/safe-parse";

export interface JsonFallbackResult<T> {
  data: T;
  /** True if the FINAL parse (after fallback if it ran) succeeded. */
  ok: boolean;
  /** Model whose output was actually parsed (default or fallback). */
  modelUsed: string;
  /** True if fallback was invoked. */
  usedFallback: boolean;
  /** Parse failure reason from the default model (only when usedFallback=true). */
  defaultParseError?: string;
  tokens: number;
}

export interface JsonFallbackOpts {
  maxTokens?: number;
  signal?: AbortSignal;
  /** Label for safeParseLLM diagnostics. */
  label: string;
}

export async function callLLMWithJsonFallback<T>(
  prompt: string,
  schema: z.ZodType<T>,
  opts: JsonFallbackOpts,
): Promise<JsonFallbackResult<T>> {
  const max = opts.maxTokens ?? 2000;
  const first = await callLLM(prompt, max, opts.signal);
  const firstParsed = safeParseLLM(schema, first.text, opts.label);
  if (firstParsed.ok || !FALLBACK_MODEL) {
    return {
      data: firstParsed.data,
      ok: firstParsed.ok,
      modelUsed: MODEL,
      usedFallback: false,
      tokens: first.usage.completionTokens,
    };
  }
  const second = await callLLM(prompt, max, opts.signal, FALLBACK_MODEL);
  const secondParsed = safeParseLLM(
    schema,
    second.text,
    `${opts.label} (fallback ${FALLBACK_MODEL})`,
  );
  return {
    data: secondParsed.ok ? secondParsed.data : firstParsed.data,
    ok: secondParsed.ok,
    modelUsed: secondParsed.ok ? FALLBACK_MODEL : MODEL,
    usedFallback: true,
    defaultParseError: "default model output failed schema",
    tokens: first.usage.completionTokens + second.usage.completionTokens,
  };
}
