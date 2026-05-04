// v2.5 Synthesis key normalizer.
// gemma4 occasionally emits JSON keys with character glitches similar to its
// known glitches in Korean prose values (e.g. "20나기" for "20세기"). When
// this happens to a Synthesis schema field name, the schema's .passthrough()
// accepts the unknown key but the canonical field stays empty, so the
// downstream pipeline silently loses data.
//
// This module post-processes the parsed Synthesis object: for each canonical
// field that ended up empty/default, look for an unknown key that's
// plausibly a misspelling of it and migrate the value over.

import type { Synthesis } from "./synthesis";

// Canonical Synthesis field names whose values are at risk of being lost
// to key-name glitches. These are the multi-perspective fields added in
// v2.5 — observed misspellings include "multi_perspective_seynthesis_ko"
// and "multi_perspective_synthesis_con_ko".
const CANONICAL_KEYS = [
  "multi_perspective_synthesis_ko",
  "complementary_insights",
  "unresolved_tensions",
  "pedagogical_scaffolding",
  // Conservative: also cover earlier fields that have been seen with key
  // typos in long-form output. If a model invents "tone_flow_kor" instead
  // of "tone_flow_ko", we'd want to catch it.
  "thesis_ko",
  "overview_essay_ko",
  "plot_reading_ko",
  "tone_flow_ko",
  "style_essay_ko",
  "cultural_notes_ko",
  "closing_note_ko",
] as const;

/**
 * Levenshtein-style edit distance between two strings, capped at the supplied
 * value. The early-exit on `rowMin > cap` was previously too aggressive for
 * insertion-heavy typos: when the typo inserts a few chars in the middle, the
 * DP's row-min temporarily climbs above cap before the alignment recovers,
 * causing the function to return cap+1 even for cases the bound should accept
 * (observed: "multi_perspective_synthesis_ko" vs "multi_perspective_s무_synthesis_ko",
 * true distance 3, was returning 4). Running the full DP is bounded by the
 * absolute length difference + cap so cost stays small.
 */
function editDistance(a: string, b: string, cap = 4): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const m = a.length;
  const n = b.length;
  const prev = new Array(n + 1).fill(0).map((_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let k = 0; k <= n; k++) prev[k] = curr[k];
  }
  return prev[n] > cap ? cap + 1 : prev[n];
}

function isEmptyForKey(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Object considered empty if all string fields are "" and all arrays are empty.
    for (const v of Object.values(obj)) {
      if (typeof v === "string" && v.length > 0) return false;
      if (Array.isArray(v) && v.length > 0) return false;
      if (typeof v === "object" && v !== null && !isEmptyForKey(v)) return false;
    }
    return true;
  }
  return false;
}

export interface KeyNormalizationOutcome {
  canonical: string;
  source: string;
  editDistance: number;
}

/**
 * Walks the parsed object's own keys; for each canonical Synthesis key that
 * is empty/default, finds the closest unknown-key match (edit distance ≤ 3,
 * length ratio close to 1) and migrates that value into the canonical slot.
 *
 * Returns the list of migrations performed for diagnostics. The synthesis
 * argument is mutated in place.
 */
export function normalizeSynthesisKeys(
  synthesis: Synthesis,
): KeyNormalizationOutcome[] {
  const obj = synthesis as unknown as Record<string, unknown>;
  const ownKeys = Object.keys(obj);
  const canonicalSet = new Set<string>(CANONICAL_KEYS);
  const unknownKeys = ownKeys.filter((k) => !canonicalSet.has(k));
  const migrations: KeyNormalizationOutcome[] = [];

  for (const canonical of CANONICAL_KEYS) {
    if (!isEmptyForKey(obj[canonical])) continue;
    let bestKey: string | null = null;
    let bestDist = 99;
    for (const candidate of unknownKeys) {
      const lenRatio =
        Math.min(candidate.length, canonical.length) /
        Math.max(candidate.length, canonical.length);
      if (lenRatio < 0.6) continue;
      const dist = editDistance(candidate, canonical, 4);
      if (dist < bestDist && dist <= 4) {
        bestDist = dist;
        bestKey = candidate;
      }
    }
    if (bestKey && !isEmptyForKey(obj[bestKey])) {
      obj[canonical] = obj[bestKey];
      delete obj[bestKey];
      migrations.push({
        canonical,
        source: bestKey,
        editDistance: bestDist,
      });
      // Remove the migrated unknown key from the candidate pool so it isn't
      // double-claimed by another canonical key.
      const idx = unknownKeys.indexOf(bestKey);
      if (idx >= 0) unknownKeys.splice(idx, 1);
    }
  }

  return migrations;
}
