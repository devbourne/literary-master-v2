// v2 Phase 3 — Korean Proofreader Agent.
//
// Targets gemma4-26b-fast's character-level Korean glitches that appear in
// long-form output (1500+ tokens) — typos like "20나기" for "20세기",
// "숭거한" for "숭고한", missing syllables ("행의" instead of "행위의").
// See model-test-on-dgx/reports/2026-05-02_korean_long_form_failure_modes.md.
//
// Strategy:
//   - Walk a fixed allowlist of synthesis Korean prose fields
//   - For each non-empty field, ask the proofreader LLM to fix character
//     errors only (explicit prompt rules forbid rephrasing)
//   - Reject the proposed fix when:
//       a. parse failed (model returned nothing usable)
//       b. diff exceeds a threshold (model is rewriting, not proofreading)
//   - Use FALLBACK_MODEL when configured (qwen3:30b is the JSON/text-precise
//     keeper from model-test-on-dgx); otherwise use the default model.

import { callLLM, FALLBACK_MODEL, MODEL } from "../llm";
import { buildKoreanProofreadPrompt } from "../prompts/korean-proofread";
import type {
  Synthesis,
  CharacterReading,
  SymbolReading,
} from "../schemas/synthesis";
import type { AnnotatedBlock } from "../schemas/block";

/** Maximum acceptable per-field character diff ratio. Above this we discard the proposed fix. */
const MAX_DIFF_RATIO = 0.05;
/** Don't proofread fields below this length — short fields aren't where glitches accumulate. */
const MIN_FIELD_CHARS = 60;

export interface KoreanProofreaderInput {
  synthesis: Synthesis;
  /** Optional: if provided, also proofread block-level Korean fields
   *  (literary_translation, literal_translation, korean_commentary).
   *  Block fields are where character glitches accumulate most for long
   *  inputs — synthesis itself often comes through clean because chunk-merge
   *  consolidates it, so without block scanning the proofreader misses the
   *  primary damage site. See model-test-on-dgx 7e8e64a1 run. */
  blocks?: AnnotatedBlock[];
  signal?: AbortSignal;
}

export interface FieldProofreadOutcome {
  fieldPath: string;
  changed: boolean;
  /** Reason a proposed change was discarded (or "applied"/"unchanged"/"empty"). */
  outcome: "applied" | "unchanged" | "empty" | "too-different" | "model-blank";
  /** Per-field char-level diff ratio of the rejected/applied change. */
  diffRatio?: number;
}

export interface KoreanProofreaderResult {
  synthesis: Synthesis;
  /** Proofread block array — populated only when input.blocks was provided. */
  blocks?: AnnotatedBlock[];
  outcomes: FieldProofreadOutcome[];
  modelUsed: string;
  changedFields: number;
  tokens: number;
  timeS: number;
}

/**
 * Levenshtein-style character diff ratio. Uses a length-tolerant approximation
 * (sum of unique chars on each side / total) good enough to catch "rewrite"
 * vs "proofread" without pulling in a real edit-distance dependency.
 */
function approxDiffRatio(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length && !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const c of setA) if (setB.has(c)) intersection++;
  const union = setA.size + setB.size - intersection;
  // Combine character-set divergence with length divergence
  const charDiverge = union > 0 ? 1 - intersection / union : 0;
  const lenDiverge = Math.abs(a.length - b.length) / Math.max(a.length, b.length, 1);
  return Math.max(charDiverge, lenDiverge);
}

async function proofreadField(
  text: string,
  fieldPath: string,
  signal: AbortSignal | undefined,
  modelOverride: string | undefined,
): Promise<{
  fixed: string;
  outcome: FieldProofreadOutcome["outcome"];
  diffRatio: number;
  tokens: number;
}> {
  if (!text || text.length < MIN_FIELD_CHARS) {
    return { fixed: text, outcome: "empty", diffRatio: 0, tokens: 0 };
  }
  const res = await callLLM(
    buildKoreanProofreadPrompt({ fieldPath, text }),
    Math.ceil(text.length * 1.5),
    signal,
    modelOverride,
  );
  const candidate = res.text.trim();
  if (!candidate) {
    return { fixed: text, outcome: "model-blank", diffRatio: 0, tokens: res.usage.completionTokens };
  }
  if (candidate === text) {
    return { fixed: text, outcome: "unchanged", diffRatio: 0, tokens: res.usage.completionTokens };
  }
  const diff = approxDiffRatio(text, candidate);
  if (diff > MAX_DIFF_RATIO) {
    return {
      fixed: text,
      outcome: "too-different",
      diffRatio: diff,
      tokens: res.usage.completionTokens,
    };
  }
  return { fixed: candidate, outcome: "applied", diffRatio: diff, tokens: res.usage.completionTokens };
}

export async function runKoreanProofreaderAgent(
  input: KoreanProofreaderInput,
): Promise<KoreanProofreaderResult> {
  const t0 = Date.now();
  // Use FALLBACK_MODEL when configured; otherwise the default. The default
  // model created the glitches in the first place, but for sites where no
  // alternative is available, having SOME pass is still better than none —
  // our diff-ratio guard prevents catastrophic regressions.
  const modelToUse = FALLBACK_MODEL || MODEL;

  const out: Synthesis = JSON.parse(JSON.stringify(input.synthesis));
  const outcomes: FieldProofreadOutcome[] = [];
  let tokens = 0;
  let changedFields = 0;

  // Top-level prose fields
  const topProseFields: { path: string; get: () => string; set: (v: string) => void }[] = [
    { path: "thesis_ko", get: () => out.thesis_ko, set: (v) => { out.thesis_ko = v; } },
    { path: "overview_essay_ko", get: () => out.overview_essay_ko, set: (v) => { out.overview_essay_ko = v; } },
    { path: "plot_reading_ko", get: () => out.plot_reading_ko, set: (v) => { out.plot_reading_ko = v; } },
    { path: "tone_flow_ko", get: () => out.tone_flow_ko, set: (v) => { out.tone_flow_ko = v; } },
    { path: "style_essay_ko", get: () => out.style_essay_ko, set: (v) => { out.style_essay_ko = v; } },
    { path: "cultural_notes_ko", get: () => out.cultural_notes_ko, set: (v) => { out.cultural_notes_ko = v; } },
    { path: "closing_note_ko", get: () => out.closing_note_ko, set: (v) => { out.closing_note_ko = v; } },
  ];

  for (const field of topProseFields) {
    if (input.signal?.aborted) {
      throw new DOMException(
        `korean-proofreader aborted at ${field.path}`,
        "AbortError",
      );
    }
    const original = field.get();
    const result = await proofreadField(original, field.path, input.signal, modelToUse);
    tokens += result.tokens;
    outcomes.push({
      fieldPath: field.path,
      changed: result.outcome === "applied",
      outcome: result.outcome,
      diffRatio: result.diffRatio || undefined,
    });
    if (result.outcome === "applied") {
      field.set(result.fixed);
      changedFields++;
    }
  }

  // Character readings: each reading_ko
  out.character_readings = await Promise.all(
    out.character_readings.map(async (cr: CharacterReading, i: number) => {
      if (input.signal?.aborted) {
        throw new DOMException(
          `korean-proofreader aborted at character_readings[${i}]`,
          "AbortError",
        );
      }
      const path = `character_readings[${i}].reading_ko`;
      const result = await proofreadField(cr.reading_ko, path, input.signal, modelToUse);
      tokens += result.tokens;
      outcomes.push({
        fieldPath: path,
        changed: result.outcome === "applied",
        outcome: result.outcome,
        diffRatio: result.diffRatio || undefined,
      });
      if (result.outcome === "applied") {
        changedFields++;
        return { ...cr, reading_ko: result.fixed };
      }
      return cr;
    }),
  );

  // Symbolism readings: each reading_ko
  out.symbolism_readings = await Promise.all(
    out.symbolism_readings.map(async (sr: SymbolReading, i: number) => {
      if (input.signal?.aborted) {
        throw new DOMException(
          `korean-proofreader aborted at symbolism_readings[${i}]`,
          "AbortError",
        );
      }
      const path = `symbolism_readings[${i}].reading_ko`;
      const result = await proofreadField(sr.reading_ko, path, input.signal, modelToUse);
      tokens += result.tokens;
      outcomes.push({
        fieldPath: path,
        changed: result.outcome === "applied",
        outcome: result.outcome,
        diffRatio: result.diffRatio || undefined,
      });
      if (result.outcome === "applied") {
        changedFields++;
        return { ...sr, reading_ko: result.fixed };
      }
      return sr;
    }),
  );

  // v2.5 Multi-perspective fields. Each prose field gets the same proofread
  // pipeline. Skipped silently when fields are empty (no Multi-Gloss layer ran).
  const mpsResult = await proofreadField(
    out.multi_perspective_synthesis_ko,
    "multi_perspective_synthesis_ko",
    input.signal,
    modelToUse,
  );
  tokens += mpsResult.tokens;
  outcomes.push({
    fieldPath: "multi_perspective_synthesis_ko",
    changed: mpsResult.outcome === "applied",
    outcome: mpsResult.outcome,
    diffRatio: mpsResult.diffRatio || undefined,
  });
  if (mpsResult.outcome === "applied") {
    out.multi_perspective_synthesis_ko = mpsResult.fixed;
    changedFields++;
  }

  // complementary_insights[].insight_ko
  out.complementary_insights = await Promise.all(
    out.complementary_insights.map(async (ci, i) => {
      if (input.signal?.aborted) {
        throw new DOMException(
          `korean-proofreader aborted at complementary_insights[${i}]`,
          "AbortError",
        );
      }
      const path = `complementary_insights[${i}].insight_ko`;
      const result = await proofreadField(ci.insight_ko, path, input.signal, modelToUse);
      tokens += result.tokens;
      outcomes.push({
        fieldPath: path,
        changed: result.outcome === "applied",
        outcome: result.outcome,
        diffRatio: result.diffRatio || undefined,
      });
      if (result.outcome === "applied") {
        changedFields++;
        return { ...ci, insight_ko: result.fixed };
      }
      return ci;
    }),
  );

  // unresolved_tensions[]: description_ko + most_defensible_ko
  out.unresolved_tensions = await Promise.all(
    out.unresolved_tensions.map(async (t, i) => {
      if (input.signal?.aborted) {
        throw new DOMException(
          `korean-proofreader aborted at unresolved_tensions[${i}]`,
          "AbortError",
        );
      }
      const next = { ...t };
      const descResult = await proofreadField(
        t.description_ko,
        `unresolved_tensions[${i}].description_ko`,
        input.signal,
        modelToUse,
      );
      tokens += descResult.tokens;
      outcomes.push({
        fieldPath: `unresolved_tensions[${i}].description_ko`,
        changed: descResult.outcome === "applied",
        outcome: descResult.outcome,
        diffRatio: descResult.diffRatio || undefined,
      });
      if (descResult.outcome === "applied") {
        next.description_ko = descResult.fixed;
        changedFields++;
      }
      const mdResult = await proofreadField(
        t.most_defensible_ko,
        `unresolved_tensions[${i}].most_defensible_ko`,
        input.signal,
        modelToUse,
      );
      tokens += mdResult.tokens;
      outcomes.push({
        fieldPath: `unresolved_tensions[${i}].most_defensible_ko`,
        changed: mdResult.outcome === "applied",
        outcome: mdResult.outcome,
        diffRatio: mdResult.diffRatio || undefined,
      });
      if (mdResult.outcome === "applied") {
        next.most_defensible_ko = mdResult.fixed;
        changedFields++;
      }
      return next;
    }),
  );

  // pedagogical_scaffolding: cultural_pitfalls_ko + korean_literature_parallels_ko
  // (discussion_questions_ko items typically below MIN_FIELD_CHARS — skipped naturally)
  if (out.pedagogical_scaffolding) {
    const cp = out.pedagogical_scaffolding;
    const cpfResult = await proofreadField(
      cp.cultural_pitfalls_ko,
      "pedagogical_scaffolding.cultural_pitfalls_ko",
      input.signal,
      modelToUse,
    );
    tokens += cpfResult.tokens;
    outcomes.push({
      fieldPath: "pedagogical_scaffolding.cultural_pitfalls_ko",
      changed: cpfResult.outcome === "applied",
      outcome: cpfResult.outcome,
      diffRatio: cpfResult.diffRatio || undefined,
    });
    if (cpfResult.outcome === "applied") {
      cp.cultural_pitfalls_ko = cpfResult.fixed;
      changedFields++;
    }

    const klResult = await proofreadField(
      cp.korean_literature_parallels_ko,
      "pedagogical_scaffolding.korean_literature_parallels_ko",
      input.signal,
      modelToUse,
    );
    tokens += klResult.tokens;
    outcomes.push({
      fieldPath: "pedagogical_scaffolding.korean_literature_parallels_ko",
      changed: klResult.outcome === "applied",
      outcome: klResult.outcome,
      diffRatio: klResult.diffRatio || undefined,
    });
    if (klResult.outcome === "applied") {
      cp.korean_literature_parallels_ko = klResult.fixed;
      changedFields++;
    }
  }

  // Block-level walk (only when input.blocks supplied — orchestrator decides
  // when to enable this based on block count + whether chunk-merge ran).
  // Each block has up to 3 Korean fields; we hit the proofreader for the ones
  // long enough to plausibly carry glitches.
  const proofreadBlocks: AnnotatedBlock[] | undefined = input.blocks
    ? new Array(input.blocks.length)
    : undefined;
  if (input.blocks && proofreadBlocks) {
    for (let i = 0; i < input.blocks.length; i++) {
      if (input.signal?.aborted) {
        throw new DOMException(
          `korean-proofreader aborted at block[${i}]`,
          "AbortError",
        );
      }
      const b = input.blocks[i];
      const next: AnnotatedBlock = { ...b };
      const fieldsToCheck: {
        key: "literary_translation" | "literal_translation" | "korean_commentary";
        label: string;
      }[] = [
        { key: "literary_translation", label: "literary" },
        { key: "literal_translation", label: "literal" },
        { key: "korean_commentary", label: "commentary" },
      ];
      for (const f of fieldsToCheck) {
        const original = (b[f.key] as string) || "";
        const path = `blocks[${i}].${f.key}`;
        const result = await proofreadField(
          original,
          path,
          input.signal,
          modelToUse,
        );
        tokens += result.tokens;
        outcomes.push({
          fieldPath: path,
          changed: result.outcome === "applied",
          outcome: result.outcome,
          diffRatio: result.diffRatio || undefined,
        });
        if (result.outcome === "applied") {
          changedFields++;
          (next[f.key] as string) = result.fixed;
        }
      }
      proofreadBlocks[i] = next;
    }
  }

  return {
    synthesis: out,
    blocks: proofreadBlocks,
    outcomes,
    modelUsed: modelToUse,
    changedFields,
    tokens,
    timeS: (Date.now() - t0) / 1000,
  };
}
