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

export interface FinalizationSignals {
  /** Coverage = received / expected; 1.0 if expected == 0. */
  coverageRatio: number;
  totalExpectedBlocks: number;
  totalReceivedBlocks: number;
  /** Number of blocks where literary or literal text is empty. */
  emptyBlockCount: number;
  verifyStatus: VerifyStatus;
  verifyIterations: number;
  /** True if WorkProfile parsed from LLM cleanly (false → fallback used). */
  profileParseOk: boolean;
  /** Count of LLM JSON-parse fallback events across the run. */
  fallbackCount: number;
  /** Set true on unrecoverable errors caught by orchestrator. */
  hasFatalError: boolean;
}

export interface FinalizationDecision {
  state: FinalizationState;
  warnings: string[];
  /** Short machine-readable reason for telemetry / debugging. */
  reason: string;
}

const COVERAGE_WARN_THRESHOLD = 0.95;

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
