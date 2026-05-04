// v2.5+ S5 — In-memory job registry for async analysis.
//
// /api/analyze always returns immediately with a jobId. The actual
// orchestration runs in the background and reports progress to this
// registry via the same `send` callback shape used previously for SSE.
// Clients poll /api/jobs/[id] for status; on completion, the storage
// layer's saved teaching-material (storageId on the job) is the canonical
// result.
//
// Lifetime is the process lifetime. Completed jobs stay in memory so
// /saved can show "recently completed (N)" status during a session;
// they're lost on server restart but the underlying TeachingMaterial
// JSON file survives — so no data loss across restart.

import { randomUUID } from "crypto";
import type { PipelineEvent, PipelinePhase } from "../types";

export type JobStatus =
  | "running"
  | "complete"
  | "complete_with_warnings"
  | "incomplete"
  | "error"
  | "cancelled";

export interface JobState {
  id: string;
  status: JobStatus;
  /** Most recent phase from orchestrator (profile / blocks / synthesis / verify / done). */
  phase?: PipelinePhase;
  statusMessage?: string;
  /** Last batch progress {done, total} when phase=blocks. */
  batchProgress?: { done: number; total: number };
  /** Synthesis stream char count. */
  synthesisChars?: number;
  /** Last verify status. */
  verifyStatus?: "VERIFIED" | "CORRECTION" | "UNCERTAIN";
  startedAt: string;
  completedAt?: string;
  /** First ~200 chars of input text (UI preview). */
  inputPreview: string;
  totalChars: number;
  /** Source metadata (URL, title, piece title) if provided by client. */
  sources?: {
    sourceUrl?: string;
    sourceTitle?: string;
    pieceTitle?: string;
  };
  /** Set when status is complete or complete_with_warnings. */
  storageId?: string;
  /** Set when complete_with_warnings. */
  warnings?: string[];
  /** Set when incomplete. */
  reason?: string;
  /** Set when error. */
  error?: string;
}

const jobs = (
  (globalThis as unknown as { __literaryJobsMap?: Map<string, JobState> })
    .__literaryJobsMap ??= new Map<string, JobState>()
);

const abortControllers = (
  (globalThis as unknown as {
    __literaryJobAbortMap?: Map<string, AbortController>;
  }).__literaryJobAbortMap ??= new Map<string, AbortController>()
);

export function createJob(input: {
  text: string;
  sources?: JobState["sources"];
}): { jobId: string; signal: AbortSignal } {
  const id = randomUUID();
  const inputPreview = input.text
    .slice(0, 200)
    .replace(/\s+/g, " ")
    .trim();
  const job: JobState = {
    id,
    status: "running",
    startedAt: new Date().toISOString(),
    inputPreview,
    totalChars: input.text.length,
    sources: input.sources,
  };
  jobs.set(id, job);
  const ac = new AbortController();
  abortControllers.set(id, ac);
  return { jobId: id, signal: ac.signal };
}

export function getJob(id: string): JobState | undefined {
  return jobs.get(id);
}

export function listJobs(filter?: {
  statuses?: JobStatus[];
}): JobState[] {
  const all = Array.from(jobs.values());
  if (!filter?.statuses?.length) {
    return all.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
  const set = new Set(filter.statuses);
  return all
    .filter((j) => set.has(j.status))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function cancelJob(id: string): boolean {
  const ac = abortControllers.get(id);
  if (!ac) return false;
  ac.abort("user-cancelled");
  const job = jobs.get(id);
  if (job && job.status === "running") {
    job.status = "cancelled";
    job.completedAt = new Date().toISOString();
  }
  return true;
}

/** Build a `send` callback that updates job state from PipelineEvents. */
export function buildJobSend(jobId: string): (event: PipelineEvent) => void {
  return (event) => {
    const job = jobs.get(jobId);
    if (!job) return;
    switch (event.type) {
      case "status":
        job.phase = event.phase;
        job.statusMessage = event.message;
        break;
      case "profile_complete":
        job.phase = "blocks";
        break;
      case "batch_start":
        job.batchProgress = {
          done: event.batchIndex,
          total: event.totalBatches,
        };
        break;
      case "batch_complete":
        job.batchProgress = {
          done: event.batchIndex + 1,
          total: job.batchProgress?.total ?? event.batchIndex + 1,
        };
        break;
      case "verify_complete":
        job.verifyStatus = event.status;
        break;
      case "complete":
        job.status = "complete";
        job.storageId = event.storageId;
        job.completedAt = new Date().toISOString();
        job.phase = "done";
        break;
      case "complete_with_warnings":
        job.status = "complete_with_warnings";
        job.storageId = event.storageId;
        job.warnings = event.warnings;
        job.completedAt = new Date().toISOString();
        job.phase = "done";
        break;
      case "incomplete":
        job.status = "incomplete";
        job.reason = event.reason;
        job.completedAt = new Date().toISOString();
        break;
      case "error":
        job.status = "error";
        job.error = event.message;
        job.completedAt = new Date().toISOString();
        break;
    }
  };
}

export function markJobError(id: string, message: string): void {
  const job = jobs.get(id);
  if (!job) return;
  if (job.status === "running") {
    job.status = "error";
    job.error = message;
    job.completedAt = new Date().toISOString();
  }
}
