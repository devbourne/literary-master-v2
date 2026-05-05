// Finalization Gate — explicit state machine for pipeline completion.
// v2 Phase A item 1. See literary-master_v2.md §3.8.
//
// Three terminal states:
//   - complete                 — all positive signals, no concerns
//   - complete_with_warnings   — finished but with non-fatal issues; persist + flag in UI
//   - incomplete               — fatal failure or no usable output; do NOT persist, allow retry

export type FinalizationState =
  | "complete"
  | "complete_with_warnings"
  | "incomplete";

export type VerifyStatus = "VERIFIED" | "CORRECTION" | "UNCERTAIN";

export type QualityBand = "low" | "medium" | "high";

export interface FinalizationSignals {
  /** Coverage = received / expected; 1.0 if expected == 0. */
  coverageRatio: number;
  totalExpectedBlocks: number;
  totalReceivedBlocks: number;
  /** Number of blocks where literary or literal text is empty. */
  emptyBlockCount: number;
  /** Blocks that the Coverage Repair Agent marked partial (could not fully recover). */
  partialBlockCount: number;
  verifyStatus: VerifyStatus;
  verifyIterations: number;
  /** True if WorkProfile parsed from LLM cleanly (false → fallback used). */
  profileParseOk: boolean;
  /** Count of LLM JSON-parse fallback events across the run. */
  fallbackCount: number;
  /** Set true on unrecoverable errors caught by orchestrator. */
  hasFatalError: boolean;

  /** v2 Phase A item 5 — Quality Agent band. Undefined if no blocks were flagged
   *  for revision (Quality Agent was skipped). */
  qualityBand?: QualityBand;
  /** Flagged ratio AFTER the revise loop. Residual flags above the medium
   *  threshold indicate revise didn't resolve the systemic flag rate. */
  qualityFlaggedRatioAfter?: number;

  /** v2.5 — Multi-Gloss layer ran for this work. False = skipped (tiny input
   *  or env-disabled) and no warning is emitted. */
  multiGlossEnabled: boolean;
  /** Angle names ("textual_en", "textual_ko", "critical", "pedagogical") that
   *  failed the angle's parseOk/error check. Only meaningful when enabled. */
  multiGlossFailedAngles: string[];
  /** Whether Stage 4b multi-perspective enrichment ran. Only when multi-gloss
   *  produced output. */
  enrichmentRan: boolean;
  /** Stage 4b parse outcome. Failure means the 4 multi-perspective synthesis
   *  fields stayed empty even though multi-gloss inputs were present. */
  enrichmentParseOk: boolean;
}

export interface FinalizationDecision {
  state: FinalizationState;
  warnings: string[];
  /** Short machine-readable reason for telemetry / debugging. */
  reason: string;
}

const COVERAGE_WARN_THRESHOLD = 0.95;
const QUALITY_RESIDUAL_FLAG_WARN = 0.1;

export function evaluateFinalizationGate(
  signals: FinalizationSignals,
): FinalizationDecision {
  // INCOMPLETE — short-circuit, do not persist
  if (signals.hasFatalError) {
    return { state: "incomplete", warnings: [], reason: "fatal_error" };
  }
  if (
    signals.totalExpectedBlocks > 0 &&
    signals.totalReceivedBlocks === 0
  ) {
    return {
      state: "incomplete",
      warnings: [],
      reason: "all_blocks_missing",
    };
  }

  // Collect non-fatal warnings
  const warnings: string[] = [];

  if (signals.coverageRatio < COVERAGE_WARN_THRESHOLD) {
    warnings.push(
      `블록 커버리지 ${(Math.round(signals.coverageRatio * 1000) / 10).toFixed(1)}% ` +
        `(expected=${signals.totalExpectedBlocks}, received=${signals.totalReceivedBlocks})`,
    );
  }
  if (signals.emptyBlockCount > 0) {
    warnings.push(`빈 번역 블록 ${signals.emptyBlockCount}개`);
  }
  if (signals.partialBlockCount > 0) {
    warnings.push(`복구 불완전 블록 ${signals.partialBlockCount}개`);
  }
  if (!signals.profileParseOk) {
    warnings.push("Profile parse 실패 (기본값/부분복구 사용)");
  }
  if (signals.fallbackCount > 0) {
    warnings.push(`LLM fallback ${signals.fallbackCount}회`);
  }
  if (signals.verifyStatus === "CORRECTION") {
    warnings.push(`Verify: CORRECTION (iter=${signals.verifyIterations})`);
  } else if (signals.verifyStatus === "UNCERTAIN") {
    warnings.push(`Verify: UNCERTAIN (iter=${signals.verifyIterations})`);
  }
  if (signals.qualityBand === "medium" || signals.qualityBand === "high") {
    const after = signals.qualityFlaggedRatioAfter;
    const afterPct =
      typeof after === "number"
        ? ` (revise 후 잔여 ${(after * 100).toFixed(0)}%)`
        : "";
    warnings.push(`Quality 밴드 ${signals.qualityBand}${afterPct}`);
  } else if (
    typeof signals.qualityFlaggedRatioAfter === "number" &&
    signals.qualityFlaggedRatioAfter > QUALITY_RESIDUAL_FLAG_WARN
  ) {
    warnings.push(
      `Revise 후 잔여 flagged ${(signals.qualityFlaggedRatioAfter * 100).toFixed(0)}%`,
    );
  }
  if (signals.multiGlossEnabled && signals.multiGlossFailedAngles.length > 0) {
    warnings.push(
      `Multi-Gloss 실패 ${signals.multiGlossFailedAngles.length}개 각도 (${signals.multiGlossFailedAngles.join(", ")})`,
    );
  }
  if (signals.enrichmentRan && !signals.enrichmentParseOk) {
    warnings.push("다관점 enrichment(Stage 4b) parse 실패 — 해당 4개 필드 비어있음");
  }

  // COMPLETE only if no warnings AND verify is VERIFIED
  if (warnings.length === 0 && signals.verifyStatus === "VERIFIED") {
    return {
      state: "complete",
      warnings: [],
      reason: "all_signals_green",
    };
  }

  return {
    state: "complete_with_warnings",
    warnings,
    reason: "warnings_present",
  };
}
