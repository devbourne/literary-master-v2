import { callLLM } from "../llm";
import { buildVerifyPrompt } from "../prompts/verify";
import { safeParseLLM } from "../schemas/safe-parse";
import { VerificationSchema } from "../schemas/teaching-material";
import type { z } from "zod";

type VerificationData = z.infer<typeof VerificationSchema>;
type VerificationStatus = VerificationData["status"];
type VerificationIssue = VerificationData["issues"][number];

export interface VerifyAgentInput {
  fullText: string;
  twistJson: string;
  report: string;
  initialEndingChars?: number;
  expandedEndingChars?: number;
  maxIterations?: number;
}

export interface VerifyAgentResult {
  status: VerificationStatus;
  issues: VerificationIssue[];
  iterations: number;
  tokens: number;
  timeS: number;
  note?: string;
  raw: string[];
}

export type AgentStep = {
  iter: number;
  action: "verify" | "expand_context" | "finalize";
  status?: VerificationStatus;
  contextChars?: number;
  issueCount?: number;
};

export async function runVerifyAgent(
  input: VerifyAgentInput,
  onStep?: (s: AgentStep) => void,
): Promise<VerifyAgentResult> {
  const maxIter = input.maxIterations ?? 3;
  const initialChars = input.initialEndingChars ?? 1500;
  const expandedChars = input.expandedEndingChars ?? 3000;

  const t0 = Date.now();
  let tokens = 0;
  const raw: string[] = [];

  let endingChars = initialChars;
  let ending = input.fullText.slice(-endingChars);
  let lastIssues: VerificationIssue[] = [];
  let lastNote: string | undefined;
  let finalStatus: VerificationStatus = "UNCERTAIN";
  let iterations = 0;

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
        report: input.report,
      }),
      1500,
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

    // Agent decision: when the model is uncertain and we still have iterations left,
    // widen the context window. Once widened, further iterations won't re-widen.
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

    // CORRECTION, or UNCERTAIN with no more expansion room → stop.
    break;
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
  };
}
