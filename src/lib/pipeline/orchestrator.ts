import { callLLM } from "../llm";
import { runProfileAgent } from "../agents/profile-agent";
import { buildBlockBatchPrompt } from "../prompts/block-batch";
import { type WorkProfile } from "../schemas/profile";
import { BatchResponseSchema, AnnotatedBlockSchema, type AnnotatedBlock } from "../schemas/block";
import { type Synthesis } from "../schemas/synthesis";
import { safeParseLLM } from "../schemas/safe-parse";
import { synthesisToPlainText } from "./synthesis-to-text";
import { splitIntoBlocks } from "./blocker";
import {
  chunkBlocks,
  summarizeProfileForBatch,
  formatPreviousTranslations,
  truncate,
} from "./batcher";
import { assemble } from "./assemble";
import { saveTeachingMaterial } from "./storage";
import { runVerifyAgent } from "../agents/verify-agent";
import {
  runCoverageRepairAgent,
  type CoverageRepairTarget,
} from "../agents/coverage-repair-agent";
import { runSynthesisAgent } from "../agents/synthesis-agent";
import { runQualityAgent } from "../agents/quality-agent";
import { runKoreanProofreaderAgent } from "../agents/korean-proofreader-agent";
import { evaluateFinalizationGate } from "./finalization-gate";
import type { PipelineEvent } from "../types";
import type { PipelineStats, Sources, StepStat } from "../schemas/teaching-material";
import { writeFileSync, mkdirSync } from "fs";

const LOG_DIR = "/tmp/analysis_logs_v2";
try {
  mkdirSync(LOG_DIR, { recursive: true });
} catch {}

function log(step: string, label: string, data: unknown) {
  const ts = new Date().toISOString().slice(11, 19);
  const filename = `${LOG_DIR}/${step}_${label}.txt`;
  const content =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);
  try {
    writeFileSync(filename, content);
  } catch {}
  console.log(
    `[${ts}] ${step}/${label}: ${content.slice(0, 150)}...`
  );
}

const MODEL = process.env.ANALYSIS_MODEL || "bjoernb/gemma4-26b-fast";
type Send = (e: PipelineEvent) => void;

// Cap persisted raw_text to avoid pathological sizes leaking into saved JSON.
// Analyzed text is already bounded by ANALYZE_MAX_CHARS in the route handler.
const RAW_TEXT_STORE_CAP = parseInt(
  process.env.RAW_TEXT_STORE_CAP || "2000000",
  10,
);

export interface SourceInput {
  rawText?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  pieceTitle?: string;
  pieceIndex?: number;
}

export async function orchestrate(
  text: string,
  send: Send,
  sourceInput?: SourceInput,
  signal?: AbortSignal,
): Promise<void> {
  function checkAborted(stage: string): void {
    if (signal?.aborted) {
      throw new DOMException(`orchestrate aborted at ${stage}`, "AbortError");
    }
  }
  const t0 = Date.now();
  const stats: StepStat[] = [];
  let totalTokens = 0;

  // Quality-signal accumulators (surfaced as warnings at completion).
  let fallbackCount = 0;
  let totalExpectedBlocks = 0;
  let totalReceivedBlocks = 0;
  const missingBlockIds: string[] = [];
  const emptyBlockIds: string[] = [];

  // ── Pass 1: Profile (v2 Phase B Profile Agent — strategy by length) ──
  send({ type: "status", phase: "profile", message: "작품 프로파일 구축 중..." });
  log("pass1", "input", `${text.length} chars`);
  const profileRes = await runProfileAgent({ text, signal });
  if (!profileRes.parseOk) fallbackCount++;
  const profile: WorkProfile = profileRes.profile;
  log("pass1", "strategy", {
    strategy: profileRes.strategy,
    partialCount: profileRes.partialCount,
    parseOk: profileRes.parseOk,
    steps: profileRes.steps,
  });
  log("pass1", "parsed_profile", profile);
  stats.push({
    step: 1,
    label: `Profile (${profileRes.strategy}${profileRes.partialCount ? `, ${profileRes.partialCount}+1 calls` : ""})`,
    tokens: profileRes.tokens,
    timeS: profileRes.timeS,
    tokS: Math.round(profileRes.tokens / Math.max(profileRes.timeS, 0.1)),
  });
  totalTokens += profileRes.tokens;
  send({ type: "profile_complete", profile });

  // ── Pass 2: Block Batches ──
  // Batch size reverted to 5 after a 3-batch experiment showed 53 batches
  // (vs 32 at size 5) put total wall-clock above the 20-30 min production
  // budget for medium-length stories. The per-batch retry below already
  // handles the loss-recovery role we wanted from the smaller batch.
  const blocks = splitIntoBlocks(text);
  const batches = chunkBlocks(blocks, 5);
  log("pass2", "blocks_count", `${blocks.length} blocks in ${batches.length} batches`);
  send({
    type: "status",
    phase: "blocks",
    message: `${blocks.length}개 블록을 ${batches.length}개 배치로 분석`,
  });

  const profileSummary = summarizeProfileForBatch(profile);
  let rollingSummary = "(첫 배치 — 이전 분석 없음)";
  const annotated: AnnotatedBlock[] = [];
  const t2Start = Date.now();
  let step2Tokens = 0;

  for (let i = 0; i < batches.length; i++) {
    checkAborted(`batch ${i}`);
    send({
      type: "batch_start",
      batchIndex: i,
      totalBatches: batches.length,
      blockIds: batches[i].map((b) => b.blockId),
    });
    const prompt = buildBlockBatchPrompt({
      profileSummary,
      rollingSummary,
      previousTranslations: formatPreviousTranslations(annotated, 2),
      batchIndex: i,
      totalBatches: batches.length,
      blocks: batches[i],
    });
    // max_predict tightened from 4000 → 2200. Each block emits ~400-500 tokens
    // of structured JSON; 5 blocks × 500 = 2500. Old 4000 was 60% headroom we
    // never used and was the dominant wall-clock cost (per-batch time scales
    // with max_predict more than with actual output size).
    const res = await callLLM(prompt, 2200, signal);
    log("pass2", `batch_${i}_raw`, res.text);

    // Try full-batch parse first
    let translations: AnnotatedBlock[] = [];
    let rollingUpdate = "";
    let parsed = safeParseLLM(BatchResponseSchema, res.text, `Batch ${i}`);
    if (parsed.data.translations.length > 0) {
      translations = parsed.data.translations;
      rollingUpdate = parsed.data.rolling_summary_update;
    } else {
      // Per-batch retry on full parse failure (always-on since v2.5):
      // attempts to recover the whole batch before falling back to single-block
      // salvage. Cheap insurance — adds at most one extra LLM call per batch
      // when the first response is malformed.
      log("pass2", `batch_${i}_retry_after_parse_fail`, "first parse empty, retrying");
      const retryRes = await callLLM(prompt, 2200, signal);
      log("pass2", `batch_${i}_retry_raw`, retryRes.text);
      step2Tokens += retryRes.usage.completionTokens;
      totalTokens += retryRes.usage.completionTokens;
      const retryParsed = safeParseLLM(
        BatchResponseSchema,
        retryRes.text,
        `Batch ${i} (retry)`,
      );
      if (retryParsed.data.translations.length > 0) {
        translations = retryParsed.data.translations;
        rollingUpdate = retryParsed.data.rolling_summary_update;
        parsed = retryParsed; // updated parse result for ok-tracking below
      } else {
        // Fallback: salvage blocks by extracting each block object individually from raw text
        translations = salvageBlocksFromRaw(res.text);
        rollingUpdate = extractRollingUpdate(res.text);
        log(
          "pass2",
          `batch_${i}_salvaged`,
          `${translations.length} blocks from raw text after retry also empty`,
        );
      }
    }

    if (!parsed.ok) fallbackCount++;

    // v2 Phase A item 4: Off-batch blockId filter — drop any block whose
    // blockId is not in this batch's expected set (LLM occasionally hallucinates
    // adjacent batches' ids when the rolling summary primes it).
    const expectedIds = new Set(batches[i].map((b) => b.blockId));
    const offBatch = translations.filter((t) => t.blockId && !expectedIds.has(t.blockId));
    if (offBatch.length > 0) {
      log("pass2", `batch_${i}_off_batch_dropped`, {
        count: offBatch.length,
        ids: offBatch.map((t) => t.blockId),
      });
      translations = translations.filter((t) => !t.blockId || expectedIds.has(t.blockId));
    }

    log("pass2", `batch_${i}_parsed`, {
      ok: parsed.ok,
      translations: translations.length,
      expected: batches[i].length,
      offBatchDropped: offBatch.length,
    });

    // Coverage: record which expected block ids were returned; flag missing/empty ones.
    const receivedIds = new Set(translations.map((t) => t.blockId).filter(Boolean));
    totalExpectedBlocks += expectedIds.size;
    totalReceivedBlocks += receivedIds.size;
    for (const id of expectedIds) {
      if (!receivedIds.has(id)) missingBlockIds.push(id);
    }

    // Attach originalText back (LLM doesn't need to return it)
    const byId = new Map(batches[i].map((b) => [b.blockId, b.text]));
    for (const tr of translations) {
      if (!tr.originalText) tr.originalText = byId.get(tr.blockId) || "";
      if (!tr.literary_translation?.trim() || !tr.literal_translation?.trim()) {
        emptyBlockIds.push(tr.blockId);
      }
      annotated.push(tr);
    }
    if (rollingUpdate) {
      rollingSummary = truncate(rollingUpdate, 1500);
    }
    step2Tokens += res.usage.completionTokens;
    totalTokens += res.usage.completionTokens;
    send({
      type: "batch_complete",
      batchIndex: i,
      blocks: translations,
      rollingSummary,
    });
  }
  const t2Time = (Date.now() - t2Start) / 1000;
  stats.push({
    step: 2,
    label: "Block Batches",
    tokens: step2Tokens,
    timeS: t2Time,
    tokS: Math.round(step2Tokens / Math.max(t2Time, 0.1)),
  });

  // ── Pass 2.5: Coverage Repair Agent (v2 Phase A item 3a) ──
  // Targets blocks that were either (a) missing entirely from batch responses
  // or (b) returned with empty literary/literal text. The agent issues a single-block
  // LLM call per target with prev/next context. Up to 2 retries each.
  // After repair, "annotated" is rebuilt in source-of-truth order via the agent.
  const repairTargets: CoverageRepairTarget[] = [];
  const seenForRepair = new Set<string>();
  for (const id of missingBlockIds) {
    if (!seenForRepair.has(id)) {
      seenForRepair.add(id);
      repairTargets.push({ blockId: id, reason: "missing" });
    }
  }
  for (const id of emptyBlockIds) {
    if (!seenForRepair.has(id)) {
      seenForRepair.add(id);
      repairTargets.push({ blockId: id, reason: "empty" });
    }
  }

  if (repairTargets.length > 0) {
    checkAborted("coverage_repair");
    send({
      type: "status",
      phase: "blocks",
      message: `누락·빈 블록 ${repairTargets.length}개 복구 중`,
    });
    const tRepair = Date.now();
    const repairRes = await runCoverageRepairAgent(
      {
        targets: repairTargets,
        allBlocks: blocks,
        annotated,
        profileSummary,
        signal,
      },
      (step) => {
        send({
          type: "agent_step",
          agent: "coverage_repair",
          iter: step.attempt,
          action: step.status,
          status: step.reason,
          issueCount: undefined,
          contextChars: undefined,
        });
      },
    );
    log("repair", "outcomes", {
      total: repairRes.outcomes.length,
      repaired: repairRes.outcomes.filter((o) => o.result === "repaired").length,
      partial: repairRes.outcomes.filter((o) => o.result === "partial").length,
      detail: repairRes.outcomes,
    });
    // Replace annotated with the agent's source-of-truth-ordered, repair-augmented array.
    annotated.length = 0;
    annotated.push(...repairRes.annotated);
    totalTokens += repairRes.tokens;
    stats.push({
      step: 2.5,
      label: `Coverage Repair (${repairRes.outcomes.length} target${repairRes.outcomes.length === 1 ? "" : "s"})`,
      tokens: repairRes.tokens,
      timeS: (Date.now() - tRepair) / 1000,
      tokS: 0,
    });
  }

  // ── Pass 3: Quality Agent (v2 Phase C — ratio-banded revise + batch retry) ──
  const initialFlaggedCount = annotated.filter(
    (b) => b.annotations?.flag_for_revision,
  ).length;
  log("pass3", "flagged_count", `${initialFlaggedCount} of ${annotated.length}`);

  if (initialFlaggedCount > 0) {
    send({
      type: "status",
      phase: "revise",
      message: `${initialFlaggedCount}개 블록 재검토`,
    });
    checkAborted("quality");
    const qualityRes = await runQualityAgent({
      annotated,
      batches,
      profileSummary,
      rollingSummary,
      signal,
    });
    fallbackCount += qualityRes.fallbackCount;
    totalTokens += qualityRes.tokens;
    log("pass3", "quality_result", {
      band: qualityRes.band,
      flaggedRatioBefore: qualityRes.flaggedRatioBefore,
      flaggedRatioAfter: qualityRes.flaggedRatioAfter,
      retriedBatchIndices: qualityRes.retriedBatchIndices,
      revisedCount: qualityRes.revisedCount,
      fallbackCount: qualityRes.fallbackCount,
    });
    stats.push({
      step: 3,
      label: `Revise (${qualityRes.band}, ${qualityRes.revisedCount} revised, ${qualityRes.retriedBatchIndices.length} batch retr.)`,
      tokens: qualityRes.tokens,
      timeS: qualityRes.timeS,
      tokS: 0,
    });
    // Existing UI event preserved per revised block — emit one bulk event so the
    // existing client-side counter still advances. (Per-block revise_one events
    // are deprecated for v2; the agent loop emits no granular events of its own.)
    for (let i = 0; i < qualityRes.revisedCount; i++) {
      send({ type: "revise_one", blockId: "" });
    }
  }

  // ── Synthesis (v2 Phase B: length-routing strategy) ──
  send({
    type: "status",
    phase: "synthesis",
    message: "종합 분석 작성 중...",
  });
  checkAborted("synthesis");
  const synthRes = await runSynthesisAgent({
    profile,
    annotated,
    summarizeBlocks: summarizeBlocksForSynthesis,
    signal,
    onProgress: (chars) => {
      send({
        type: "status",
        phase: "synthesis",
        message: `종합 분석 작성 중 · ${chars.toLocaleString()}자 수신`,
      });
    },
  });
  if (!synthRes.parseOk) fallbackCount++;
  const synthesis: Synthesis = synthRes.synthesis;
  totalTokens += synthRes.tokens;
  stats.push({
    step: 4,
    label: `Synthesis (${synthRes.strategy}${synthRes.partialCount ? `, ${synthRes.partialCount}+1 calls` : ""})`,
    tokens: synthRes.tokens,
    timeS: synthRes.timeS,
    tokS: 0,
  });
  log("synthesis", "strategy", {
    strategy: synthRes.strategy,
    partialCount: synthRes.partialCount,
    parseOk: synthRes.parseOk,
    steps: synthRes.steps,
  });
  let synthesisForOutput: Synthesis = synthesis;

  // ── Phase 3: Korean Proofreader (post-Synthesis, pre-Verify) ──
  // Two trigger paths:
  //   - Synthesis-side: long single-shot synthesis (≥ 800 chars in major
  //     prose fields).
  //   - Block-side: large analyses (≥ 30 blocks) — but only when explicitly
  //     enabled via PROOFREAD_BLOCKS=true env var. Block walking adds 159
  //     × ~2s = ~5 min (uncached) which alone is ~25% of the production
  //     20-30 min budget; defaulting it off keeps full short stories in
  //     budget and lets users opt in for "publication grade" runs.
  const synthesisProseLen =
    (synthesis.overview_essay_ko?.length ?? 0) +
    (synthesis.plot_reading_ko?.length ?? 0) +
    (synthesis.style_essay_ko?.length ?? 0);
  const proofreadBlocksEnabled =
    process.env.PROOFREAD_BLOCKS === "true" ||
    process.env.PROOFREAD_BLOCKS === "1";
  const shouldProofreadSynthesis = synthesisProseLen >= 800;
  const shouldProofreadBlocks =
    proofreadBlocksEnabled && annotated.length >= 30;
  if (shouldProofreadSynthesis || shouldProofreadBlocks) {
    checkAborted("korean_proofread");
    send({
      type: "status",
      phase: "synthesis",
      message: shouldProofreadBlocks
        ? `한국어 교정 중 (${annotated.length}개 블록 + synthesis)...`
        : "한국어 교정 중 (synthesis)...",
    });
    const proof = await runKoreanProofreaderAgent({
      synthesis: synthesisForOutput,
      blocks: shouldProofreadBlocks ? annotated : undefined,
      signal,
    });
    synthesisForOutput = proof.synthesis;
    if (proof.blocks) {
      annotated.length = 0;
      annotated.push(...proof.blocks);
    }
    totalTokens += proof.tokens;
    log("korean_proofread", "outcomes", {
      modelUsed: proof.modelUsed,
      changedFields: proof.changedFields,
      total: proof.outcomes.length,
      synthesisProseLen,
      blockCount: annotated.length,
      detail: proof.outcomes.filter((o) => o.changed),
    });
    stats.push({
      step: 4.5,
      label: `Korean Proofread (${proof.changedFields}/${proof.outcomes.length} fields fixed)`,
      tokens: proof.tokens,
      timeS: proof.timeS,
      tokS: 0,
    });
  } else {
    log("korean_proofread", "skipped", {
      reason: "synthesis too short and block count below threshold",
      synthesisProseLen,
      blockCount: annotated.length,
    });
  }

  const synthesisPlain = synthesisToPlainText(synthesisForOutput);

  // ── Verify (agentic, v2 with CORRECTION-apply loop) ──
  send({ type: "status", phase: "verify", message: "원문 대조 검증 중..." });
  checkAborted("verify");
  const verifyRes = await runVerifyAgent(
    {
      fullText: text,
      twistJson: JSON.stringify(profile.twist),
      report: synthesisPlain,
      initialEndingChars: 1500,
      expandedEndingChars: 3000,
      // Reduced from 3 to 2 for production budget. Round 2 already gives the
      // CORRECTION-apply loop one shot; iter 3 historically rarely converged
      // (gemma4 reproduces the same issues on re-verify) and added 30-60s.
      maxIterations: 2,
      signal,
      // v2: pass the proofread synthesis + a renderer so the agent can apply
      // CORRECTION fixes to the JSON in-place and re-verify.
      synthesis: synthesisForOutput,
      renderReport: (s) => synthesisToPlainText(s),
    },
    (step) => {
      send({
        type: "agent_step",
        agent: "verify",
        iter: step.iter,
        action: step.action,
        status: step.status,
        contextChars: step.contextChars,
        issueCount: step.issueCount,
      });
    },
  );
  totalTokens += verifyRes.tokens;
  if (verifyRes.finalSynthesis) {
    synthesisForOutput = verifyRes.finalSynthesis;
  }
  log("verify", "agent_result", {
    status: verifyRes.status,
    iterations: verifyRes.iterations,
    issues: verifyRes.issues.length,
    correctionsApplied: verifyRes.correctionsApplied.length,
    correctionsApplyDetail: verifyRes.correctionsApplied,
  });
  stats.push({
    step: 5,
    label: `Verify (agent, ${verifyRes.iterations} iter)`,
    tokens: verifyRes.tokens,
    timeS: verifyRes.timeS,
    tokS: 0,
  });
  const verified = verifyRes.status === "VERIFIED";
  send({
    type: "verify_complete",
    verified,
    status: verifyRes.status,
    iterations: verifyRes.iterations,
    issues: verifyRes.issues,
    text: verifyRes.note || verifyRes.raw[verifyRes.raw.length - 1] || "",
  });

  // ── Assemble ──
  const totalTimeS = (Date.now() - t0) / 1000;
  const pipelineStats: PipelineStats = {
    totalTokens,
    totalTimeS: Math.round(totalTimeS * 10) / 10,
    avgTokS: Math.round(totalTokens / Math.max(totalTimeS, 0.1)),
    steps: stats,
  };

  const rawText = sourceInput?.rawText ?? text;
  const cappedRaw =
    rawText.length > RAW_TEXT_STORE_CAP
      ? rawText.slice(0, RAW_TEXT_STORE_CAP)
      : rawText;
  const sources: Sources = {
    raw_text: cappedRaw,
    analyzed_text: text,
    source_url: sourceInput?.sourceUrl,
    source_title: sourceInput?.sourceTitle,
    piece_title: sourceInput?.pieceTitle,
    piece_index: sourceInput?.pieceIndex,
    imported_at: new Date().toISOString(),
  };

  log("assemble", "annotated_count", `${annotated.length} blocks to assemble`);
  const teachingMaterial = assemble({
    profile,
    blocks: annotated,
    synthesis: synthesisForOutput,
    synthesisMd: "",
    verify: {
      status: verifyRes.status,
      note: verified ? undefined : (verifyRes.note ?? "").slice(0, 800) || undefined,
      issues: verifyRes.issues,
      iterations: verifyRes.iterations,
    },
    stats: pipelineStats,
    modelUsed: MODEL,
    source: sourceInput?.sourceUrl,
    sources,
  });

  // Compute signals for the Finalization Gate (v2 §3.8) — recompute coverage
  // from the FINAL annotated array so coverage repair is reflected.
  const finalReceivedIds = new Set(
    annotated.map((b) => b.blockId).filter(Boolean),
  );
  const finalCoverageRatio =
    blocks.length > 0 ? finalReceivedIds.size / blocks.length : 1;
  const finalEmptyCount = annotated.filter(
    (b) =>
      !b.literary_translation?.trim() || !b.literal_translation?.trim(),
  ).length;
  const finalPartialCount = annotated.filter((b) => b.partial === true).length;

  const decision = evaluateFinalizationGate({
    coverageRatio: finalCoverageRatio,
    totalExpectedBlocks: blocks.length,
    totalReceivedBlocks: finalReceivedIds.size,
    emptyBlockCount: finalEmptyCount,
    partialBlockCount: finalPartialCount,
    verifyStatus: verifyRes.status,
    verifyIterations: verifyRes.iterations,
    profileParseOk: profileRes.parseOk,
    fallbackCount,
    hasFatalError: false,
  });

  log("assemble", "coverage", {
    expected: blocks.length,
    received: finalReceivedIds.size,
    empty: finalEmptyCount,
    partial: finalPartialCount,
    fallbackCount,
    gate: decision,
  });

  // INCOMPLETE — do not persist; allow client to retry
  if (decision.state === "incomplete") {
    log("assemble", "incomplete", {
      reason: decision.reason,
    });
    send({
      type: "incomplete",
      reason: decision.reason,
      retryable: true,
    });
    return;
  }

  // Persist for both complete and complete_with_warnings
  const storageId = saveTeachingMaterial(teachingMaterial);
  log("assemble", "summary", {
    id: storageId,
    state: decision.state,
    title: teachingMaterial.metadata.title,
    blocks: teachingMaterial.blocks.length,
    characters: teachingMaterial.profile.characters.length,
    foreshadowing: teachingMaterial.profile.foreshadowing.length,
  });

  if (decision.state === "complete_with_warnings") {
    send({
      type: "complete_with_warnings",
      storageId,
      synthesisMd: "",
      warnings: decision.warnings,
    });
  } else {
    send({ type: "complete", storageId, synthesisMd: "" });
  }
}

// Salvage individual block objects from raw text by locating { ... } boundaries in translations array
function salvageBlocksFromRaw(raw: string): AnnotatedBlock[] {
  // Find "translations": [ ... ] block
  const tStart = raw.indexOf('"translations"');
  if (tStart < 0) return [];
  const arrStart = raw.indexOf("[", tStart);
  if (arrStart < 0) return [];

  // Walk through the array finding individual object boundaries (depth-tracking)
  const blocks: AnnotatedBlock[] = [];
  let i = arrStart + 1;
  while (i < raw.length) {
    // Skip whitespace
    while (i < raw.length && /\s|,/.test(raw[i])) i++;
    if (raw[i] === "]") break;
    if (raw[i] !== "{") {
      i++;
      continue;
    }
    // Walk to matching closing brace
    let depth = 0;
    const start = i;
    let inStr = false;
    let esc = false;
    for (; i < raw.length; i++) {
      const c = raw[i];
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }
    const objText = raw.slice(start, i);
    // Try to parse this single block
    const block = tryParseBlock(objText);
    if (block) blocks.push(block);
  }
  return blocks;
}

function tryParseBlock(objText: string): AnnotatedBlock | null {
  // Apply common fixes: unquoted keys, extra commas, etc.
  const attempts: string[] = [objText];

  // Fix: unquoted keys like `_ko_gloss":`
  attempts.push(objText.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*":/g, '$1"$2":'));

  // Fix: trailing commas
  attempts.push(objText.replace(/,(\s*[\]}])/g, "$1"));

  for (const text of attempts) {
    try {
      const obj = JSON.parse(text);
      const result = AnnotatedBlockSchema.safeParse(obj);
      if (result.success) return result.data;
      // Use salvage from safe-parse to keep what's valid
      const partialFallback = AnnotatedBlockSchema.safeParse({});
      if (partialFallback.success) {
        const merged = { ...partialFallback.data, ...obj } as Record<string, unknown>;
        const mergedResult = AnnotatedBlockSchema.safeParse(merged);
        if (mergedResult.success) return mergedResult.data;
      }
    } catch {}
  }
  return null;
}

function extractRollingUpdate(raw: string): string {
  const m = raw.match(/"rolling_summary_update"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  return m ? m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n") : "";
}

function summarizeBlocksForSynthesis(blocks: AnnotatedBlock[]): string {
  return blocks
    .map((b) => {
      const a = b.annotations;
      const flags = [
        a.containsForeshadowing ? "복선" : "",
        a.sceneTransition ? "장면전환" : "",
        a.toneShift ? `톤변화(${a.toneShift})` : "",
        a.symbolismPresent.length
          ? `상징(${a.symbolismPresent.join(",")})`
          : "",
      ]
        .filter(Boolean)
        .join("; ");
      return `[${b.blockId}] ${b.korean_commentary}${flags ? ` — ${flags}` : ""}`;
    })
    .join("\n");
}
