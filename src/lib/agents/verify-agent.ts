import { callLLM, ADVERSARIAL_VERIFY_MODEL } from "../llm";
import { buildVerifyPrompt } from "../prompts/verify";
import { buildSynthesisFixPrompt } from "../prompts/synthesis-fix";
import { safeParseLLM } from "../schemas/safe-parse";
import { VerificationSchema } from "../schemas/teaching-material";
import { SynthesisSchema, type Synthesis } from "../schemas/synthesis";
import type { z } from "zod";

type VerificationData = z.infer<typeof VerificationSchema>;
type VerificationStatus = VerificationData["status"];
type VerificationIssue = VerificationData["issues"][number];

export interface VerifyAgentInput {
  fullText: string;
  twistJson: string;
  /** Plain-text rendering of the synthesis (used for the verify prompt). */
  report: string;
  initialEndingChars?: number;
  expandedEndingChars?: number;
  maxIterations?: number;
  signal?: AbortSignal;

  // v2 Phase A item 3b — Verify v2 fields. When BOTH `synthesis` and
  // `renderReport` are provided, the agent will, on CORRECTION:
  //   1. apply each suggested_fix to the synthesis JSON via a separate LLM call
  //   2. re-render the report from the updated synthesis
  //   3. re-verify (looped up to maxIterations)
  // Without these, the agent runs in legacy single-pass mode (UNCERTAIN-only loop).
  synthesis?: Synthesis;
  renderReport?: (s: Synthesis) => string;
}

export interface CorrectionApplied {
  iteration: number;
  section: string;
  description: string;
  /** True if the synthesis JSON parse after the fix call succeeded. */
  applied: boolean;
  /** Reason the apply failed (parse error, identical JSON, …). */
  failureReason?: string;
}

export interface AdversarialCheck {
  /** Model that ran the cross-check. */
  model: string;
  /** Status returned by the adversarial model. */
  status: VerificationStatus;
  /** Issue count from the adversarial pass. */
  issueCount: number;
  /** True if the original status was upgraded based on adversarial agreement. */
  upgradedToVerified: boolean;
}

export interface VerifyAgentResult {
  /**
   * Final disposition. With Verify v2 inputs (synthesis + renderReport):
   *  - "VERIFIED"            — succeeded on first iteration, no corrections
   *  - "VERIFIED"            — succeeded after corrections (correctionsApplied non-empty)
   *  - "VERIFIED"            — upgraded by Phase F-2 adversarial cross-check
   *  - "CORRECTION"          — exhausted maxIterations, residual issues remain
   *  - "UNCERTAIN"           — model uncertain, no productive correction available
   * Without v2 inputs, falls back to the original status semantics.
   */
  status: VerificationStatus;
  issues: VerificationIssue[];
  iterations: number;
  tokens: number;
  timeS: number;
  note?: string;
  raw: string[];

  /** v2: corrections attempted across all iterations. */
  correctionsApplied: CorrectionApplied[];
  /** v2: synthesis after corrections (returned if any apply succeeded). */
  finalSynthesis?: Synthesis;
  /** Phase F-2: adversarial cross-check disposition (only set when run). */
  adversarial?: AdversarialCheck;
}

export type AgentStep = {
  iter: number;
  action: "verify" | "expand_context" | "apply_correction" | "finalize";
  status?: VerificationStatus;
  contextChars?: number;
  issueCount?: number;
  /** For apply_correction steps: section + applied flag. */
  section?: string;
  applied?: boolean;
};

export async function runVerifyAgent(
  input: VerifyAgentInput,
  onStep?: (s: AgentStep) => void,
): Promise<VerifyAgentResult> {
  const maxIter = input.maxIterations ?? 3;
  const initialChars = input.initialEndingChars ?? 1500;
  const expandedChars = input.expandedEndingChars ?? 3000;
  const v2Enabled = !!(input.synthesis && input.renderReport);

  const t0 = Date.now();
  let tokens = 0;
  const raw: string[] = [];
  const correctionsApplied: CorrectionApplied[] = [];

  let endingChars = initialChars;
  let ending = input.fullText.slice(-endingChars);
  let lastIssues: VerificationIssue[] = [];
  let lastNote: string | undefined;
  let finalStatus: VerificationStatus = "UNCERTAIN";
  let iterations = 0;

  // Working copies for v2 (mutated as corrections succeed)
  let workingSynthesis: Synthesis | undefined = input.synthesis;
  let workingReport = input.report;

  for (let i = 0; i < maxIter; i++) {
    iterations = i + 1;
    onStep?.({
      iter: iterations,
      action: "verify",
      contextChars: endingChars,
    });

    const res = await callLLM(
      buildVerifyPrompt({
        ending,
        twist: input.twistJson,
        report: workingReport,
      }),
      1500,
      input.signal,
    );
    tokens += res.usage.completionTokens;
    raw.push(res.text);

    const parsed = safeParseLLM(
      VerificationSchema,
      res.text,
      `VerifyAgent iter ${iterations}`,
    );
    const data = parsed.data;
    finalStatus = data.status;
    lastIssues = data.issues ?? [];
    lastNote =
      (data as { summary?: string }).summary ||
      (lastIssues.length > 0
        ? lastIssues
            .map((it) => `[${it.section}] ${it.description}`)
            .join("\n")
        : undefined);

    onStep?.({
      iter: iterations,
      action: "verify",
      status: finalStatus,
      issueCount: lastIssues.length,
    });

    if (finalStatus === "VERIFIED") {
      break;
    }

    // v2 path: CORRECTION → apply each issue's suggested_fix to synthesis,
    // re-render report, then loop back to verify.
    if (
      v2Enabled &&
      finalStatus === "CORRECTION" &&
      i < maxIter - 1 &&
      workingSynthesis &&
      input.renderReport
    ) {
      const applicableIssues = lastIssues.filter(
        (it) => !!it.suggested_fix && it.suggested_fix.trim().length > 0,
      );
      if (applicableIssues.length === 0) {
        // No actionable fixes — stop the loop instead of looping uselessly.
        break;
      }

      let anyApplied = false;
      for (const issue of applicableIssues) {
        const beforeJson = JSON.stringify(workingSynthesis);
        const fixRes = await callLLM(
          buildSynthesisFixPrompt({
            synthesisJson: beforeJson,
            section: issue.section || "(unspecified)",
            description: issue.description,
            suggestedFix: issue.suggested_fix as string,
          }),
          6000,
          input.signal,
        );
        tokens += fixRes.usage.completionTokens;
        raw.push(fixRes.text);

        const fixParsed = safeParseLLM(
          SynthesisSchema,
          fixRes.text,
          `VerifyAgent iter ${iterations} apply_fix [${issue.section}]`,
        );

        const failureReason =
          !fixParsed.ok
            ? "synthesis JSON parse failed after fix"
            : JSON.stringify(fixParsed.data) === beforeJson
              ? "fix produced no change"
              : undefined;

        const applied = !failureReason;
        if (applied) {
          workingSynthesis = fixParsed.data;
          anyApplied = true;
        }

        correctionsApplied.push({
          iteration: iterations,
          section: issue.section || "(unspecified)",
          description: issue.description,
          applied,
          failureReason,
        });

        onStep?.({
          iter: iterations,
          action: "apply_correction",
          section: issue.section,
          applied,
        });
      }

      if (anyApplied && workingSynthesis && input.renderReport) {
        workingReport = input.renderReport(workingSynthesis);
        // Continue the loop — next iteration verifies the updated report.
        continue;
      } else {
        // No fixes succeeded; further iterations would just reproduce the same issues.
        break;
      }
    }

    // Legacy / non-v2 UNCERTAIN expansion path.
    const canExpand = endingChars < expandedChars && input.fullText.length > endingChars;
    if (finalStatus === "UNCERTAIN" && i < maxIter - 1 && canExpand) {
      endingChars = expandedChars;
      ending = input.fullText.slice(-endingChars);
      onStep?.({
        iter: iterations,
        action: "expand_context",
        contextChars: endingChars,
      });
      continue;
    }

    // CORRECTION (without v2 inputs) or UNCERTAIN with no more expansion room → stop.
    break;
  }

  // Phase F-2: Adversarial cross-check. When the main loop ends UNCERTAIN
  // and an adversarial model is configured, run one final verify pass with
  // the adversarial model on the same (working) report. If the adversarial
  // says VERIFIED, upgrade. Other outcomes are recorded but don't change
  // status — the agreement signal only flows in the corroborating direction.
  let adversarial: AdversarialCheck | undefined;
  if (finalStatus === "UNCERTAIN" && ADVERSARIAL_VERIFY_MODEL) {
    if (!input.signal?.aborted) {
      const advRes = await callLLM(
        buildVerifyPrompt({
          ending,
          twist: input.twistJson,
          report: workingReport,
        }),
        1500,
        input.signal,
        ADVERSARIAL_VERIFY_MODEL,
      );
      tokens += advRes.usage.completionTokens;
      raw.push(advRes.text);
      const advParsed = safeParseLLM(
        VerificationSchema,
        advRes.text,
        `VerifyAgent adversarial (${ADVERSARIAL_VERIFY_MODEL})`,
      );
      const advData = advParsed.data;
      const upgraded = advData.status === "VERIFIED";
      adversarial = {
        model: ADVERSARIAL_VERIFY_MODEL,
        status: advData.status,
        issueCount: (advData.issues ?? []).length,
        upgradedToVerified: upgraded,
      };
      if (upgraded) {
        finalStatus = "VERIFIED";
        const note = `Cross-validated by ${ADVERSARIAL_VERIFY_MODEL}`;
        lastNote = lastNote ? `${lastNote}\n${note}` : note;
      }
    }
  }

  onStep?.({
    iter: iterations,
    action: "finalize",
    status: finalStatus,
    issueCount: lastIssues.length,
  });

  return {
    status: finalStatus,
    issues: lastIssues,
    iterations,
    tokens,
    timeS: (Date.now() - t0) / 1000,
    note: lastNote,
    raw,
    correctionsApplied,
    finalSynthesis: correctionsApplied.some((c) => c.applied)
      ? workingSynthesis
      : undefined,
    adversarial,
  };
}
