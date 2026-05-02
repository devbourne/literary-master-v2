// v2.5 Multi-Gloss Agent.
//
// Runs three model-specialized perspective glosses in parallel after
// Coverage Repair, before Synthesis. Each angle is mapped to the model
// whose strength matches it (validated by model-test-on-dgx evaluations):
//
//   Angle 1 — Textual close-reading        → gpt-oss:120b (English)
//             → translation pass to Korean → gemma4
//   Angle 2 — Critical / theoretical readings → qwen3:30b (Korean JSON)
//   Angle 3 — Korean reader pedagogical    → gemma4 (Korean prose)
//
// Result is fed into the Synthesis prompt as enrichment context. Synthesis
// still produces its existing schema; multi-gloss content gets integrated
// into existing fields (no new top-level synthesis fields per current design).

import { callLLM } from "../llm";
import { buildTextualGlossPrompt } from "../prompts/gloss-textual";
import { buildTextualGlossTranslatePrompt } from "../prompts/gloss-textual-translate";
import { buildCriticalGlossPrompt } from "../prompts/gloss-critical";
import { buildPedagogicalGlossPrompt } from "../prompts/gloss-pedagogical";
import { safeParseLLM } from "../schemas/safe-parse";
import {
  CriticalGlossSchema,
  PedagogicalGlossSchema,
  type CriticalGloss,
  type MultiGloss,
  type PedagogicalGloss,
  type TextualGloss,
} from "../schemas/gloss";
import type { WorkProfile } from "../schemas/profile";

// Models hard-coded to their strengths. Override via env if you need to
// pin to a single model in resource-constrained environments.
const TEXTUAL_MODEL =
  process.env.MULTI_GLOSS_TEXTUAL_MODEL || "gpt-oss:120b";
const CRITICAL_MODEL =
  process.env.MULTI_GLOSS_CRITICAL_MODEL ||
  "qwen3:30b-a3b-instruct-2507-q4_K_M";
// Pedagogical + translation use the orchestrator's default model
// (passed in via input.translationModel) to avoid duplicating the env-var
// resolution chain — the default model is already gemma4 in production.

export interface MultiGlossAgentInput {
  text: string;
  profile: WorkProfile;
  glossarySection?: string;
  signal?: AbortSignal;
  /**
   * Model to use for both the pedagogical gloss and the textual translation
   * pass. In practice the orchestrator passes the default model (gemma4) so
   * the Korean output stays in the model with the strongest Korean depth.
   */
  translationModel?: string;
}

export interface MultiGlossAgentResult {
  multiGloss: MultiGloss;
  /** Per-angle diagnostics. */
  steps: Array<{
    angle: "textual_en" | "textual_ko" | "critical" | "pedagogical";
    model: string;
    parseOk: boolean;
    tokens: number;
    timeS: number;
    error?: string;
  }>;
  totalTokens: number;
  /** Wall-clock for the full multi-gloss layer. */
  timeS: number;
}

async function runTextualEnglish(
  input: MultiGlossAgentInput,
): Promise<{ analysis: string; tokens: number; timeS: number; error?: string }> {
  const t0 = Date.now();
  try {
    const res = await callLLM(
      buildTextualGlossPrompt({
        text: input.text,
        profile: input.profile,
      }),
      3000,
      input.signal,
      TEXTUAL_MODEL,
    );
    return {
      analysis: res.text.trim(),
      tokens: res.usage.completionTokens,
      timeS: (Date.now() - t0) / 1000,
    };
  } catch (e) {
    return {
      analysis: "",
      tokens: 0,
      timeS: (Date.now() - t0) / 1000,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function runTextualKoreanTranslation(
  englishAnalysis: string,
  glossarySection: string | undefined,
  signal: AbortSignal | undefined,
  model: string | undefined,
): Promise<{ translation: string; tokens: number; timeS: number; error?: string }> {
  const t0 = Date.now();
  if (!englishAnalysis) {
    return { translation: "", tokens: 0, timeS: 0 };
  }
  try {
    const res = await callLLM(
      buildTextualGlossTranslatePrompt({
        englishAnalysis,
        glossarySection,
      }),
      3000,
      signal,
      model,
    );
    return {
      translation: res.text.trim(),
      tokens: res.usage.completionTokens,
      timeS: (Date.now() - t0) / 1000,
    };
  } catch (e) {
    return {
      translation: "",
      tokens: 0,
      timeS: (Date.now() - t0) / 1000,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function runCritical(
  input: MultiGlossAgentInput,
): Promise<{ data: CriticalGloss; ok: boolean; tokens: number; timeS: number; error?: string }> {
  const t0 = Date.now();
  try {
    const res = await callLLM(
      buildCriticalGlossPrompt({
        text: input.text,
        profile: input.profile,
        glossarySection: input.glossarySection,
      }),
      2500,
      input.signal,
      CRITICAL_MODEL,
    );
    const parsed = safeParseLLM(
      CriticalGlossSchema,
      res.text,
      "MultiGloss critical",
    );
    return {
      data: parsed.data,
      ok: parsed.ok,
      tokens: res.usage.completionTokens,
      timeS: (Date.now() - t0) / 1000,
    };
  } catch (e) {
    return {
      data: { critical_readings: [] },
      ok: false,
      tokens: 0,
      timeS: (Date.now() - t0) / 1000,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function runPedagogical(
  input: MultiGlossAgentInput,
): Promise<{ data: PedagogicalGloss; ok: boolean; tokens: number; timeS: number; error?: string }> {
  const t0 = Date.now();
  try {
    const res = await callLLM(
      buildPedagogicalGlossPrompt({
        text: input.text,
        profile: input.profile,
        glossarySection: input.glossarySection,
      }),
      2500,
      input.signal,
      input.translationModel, // gemma4 in production
    );
    const parsed = safeParseLLM(
      PedagogicalGlossSchema,
      res.text,
      "MultiGloss pedagogical",
    );
    return {
      data: parsed.data,
      ok: parsed.ok,
      tokens: res.usage.completionTokens,
      timeS: (Date.now() - t0) / 1000,
    };
  } catch (e) {
    return {
      data: {
        cultural_pitfalls_ko: "",
        korean_literature_parallels_ko: "",
        discussion_questions_ko: [],
      },
      ok: false,
      tokens: 0,
      timeS: (Date.now() - t0) / 1000,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function runMultiGlossAgent(
  input: MultiGlossAgentInput,
): Promise<MultiGlossAgentResult> {
  const t0 = Date.now();

  // Three angles dispatched concurrently. The textual_en (gpt-oss:120b)
  // is the slowest; critical (qwen3) and pedagogical (gemma4) are quicker
  // and finish well inside textual_en's wall-clock.
  const [textualEnRes, criticalRes, pedagogicalRes] = await Promise.all([
    runTextualEnglish(input),
    runCritical(input),
    runPedagogical(input),
  ]);

  // Translation pass runs after textual_en (it depends on the English text).
  // Total wall-clock = max(textual_en + translation, critical, pedagogical)
  // ≈ textual_en + translation in practice.
  const textualKoRes = await runTextualKoreanTranslation(
    textualEnRes.analysis,
    input.glossarySection,
    input.signal,
    input.translationModel,
  );

  const textual: TextualGloss = {
    english_analysis: textualEnRes.analysis,
    korean_translation: textualKoRes.translation,
  };

  const totalTokens =
    textualEnRes.tokens +
    textualKoRes.tokens +
    criticalRes.tokens +
    pedagogicalRes.tokens;

  return {
    multiGloss: {
      textual,
      critical: criticalRes.data,
      pedagogical: pedagogicalRes.data,
    },
    steps: [
      {
        angle: "textual_en",
        model: TEXTUAL_MODEL,
        parseOk: !textualEnRes.error,
        tokens: textualEnRes.tokens,
        timeS: textualEnRes.timeS,
        error: textualEnRes.error,
      },
      {
        angle: "textual_ko",
        model: input.translationModel || "(default)",
        parseOk: !textualKoRes.error,
        tokens: textualKoRes.tokens,
        timeS: textualKoRes.timeS,
        error: textualKoRes.error,
      },
      {
        angle: "critical",
        model: CRITICAL_MODEL,
        parseOk: criticalRes.ok,
        tokens: criticalRes.tokens,
        timeS: criticalRes.timeS,
        error: criticalRes.error,
      },
      {
        angle: "pedagogical",
        model: input.translationModel || "(default)",
        parseOk: pedagogicalRes.ok,
        tokens: pedagogicalRes.tokens,
        timeS: pedagogicalRes.timeS,
        error: pedagogicalRes.error,
      },
    ],
    totalTokens,
    timeS: (Date.now() - t0) / 1000,
  };
}
