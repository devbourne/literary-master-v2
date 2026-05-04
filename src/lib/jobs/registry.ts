// v2.5+ S5 — Persistent job registry for async analysis.
//
// /api/analyze always returns immediately with a jobId. The actual
// orchestration runs in the background and reports progress to this
// registry via the same `send` callback shape used previously for SSE.
// Clients poll /api/jobs/[id] for status; on completion, the storage
// layer's saved teaching-material (storageId on the job) is the canonical
// result.
//
// v2.5.2 hardening:
//   - Job state is persisted to data/jobs/{id}.json on every mutation
//     (atomic write + rename). Survives server restart.
//   - On module load, all existing jobs are hydrated from disk; any job
//     still marked "running" is reclassified as "error" with an
//     "abandoned-on-restart" message — the orchestration that owned it
//     no longer exists.
//   - A background interval prunes terminal jobs older than
//     JOB_RETENTION_DAYS (default 7) from both memory and disk.

import { randomUUID } from "crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { join } from "path";
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

/* ── Disk persistence ─────────────────────────────────────── */

const JOBS_DIR = join(process.cwd(), "data", "jobs");
const RETENTION_DAYS = parseFloat(process.env.JOB_RETENTION_DAYS || "7") || 7;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function ensureDir(): void {
  if (!existsSync(JOBS_DIR)) {
    mkdirSync(JOBS_DIR, { recursive: true });
  }
}

function jobPath(id: string): string {
  return join(JOBS_DIR, `${id}.json`);
}

function persistJob(job: JobState): void {
  try {
    ensureDir();
    const tmp = jobPath(job.id) + ".tmp";
    writeFileSync(tmp, JSON.stringify(job), "utf8");
    renameSync(tmp, jobPath(job.id));
  } catch (e) {
    // Persistence failure is logged but not fatal — in-memory state is
    // still correct, only crash recovery for this job is lost.
    console.warn(`[jobs] failed to persist ${job.id}:`, e);
  }
}

function deletePersistedJob(id: string): void {
  try {
    const p = jobPath(id);
    if (existsSync(p)) unlinkSync(p);
  } catch (e) {
    console.warn(`[jobs] failed to delete ${id}:`, e);
  }
}

function hydrateFromDisk(): Map<string, JobState> {
  const map = new Map<string, JobState>();
  ensureDir();
  let abandoned = 0;
  let loaded = 0;
  for (const fname of readdirSync(JOBS_DIR)) {
    if (!fname.endsWith(".json")) continue;
    try {
      const raw = readFileSync(join(JOBS_DIR, fname), "utf8");
      const job = JSON.parse(raw) as JobState;
      if (!job.id) continue;
      // Any job still "running" cannot possibly still be running — the
      // orchestration that owned it is gone with the previous process.
      if (job.status === "running") {
        job.status = "error";
        job.error = "abandoned: server restarted while job was running";
        job.completedAt = new Date().toISOString();
        abandoned++;
        // Persist the corrected state so next restart doesn't repeat.
        try {
          writeFileSync(join(JOBS_DIR, fname), JSON.stringify(job), "utf8");
        } catch {}
      }
      map.set(job.id, job);
      loaded++;
    } catch (e) {
      console.warn(`[jobs] failed to load ${fname}:`, e);
    }
  }
  if (loaded > 0 || abandoned > 0) {
    console.log(
      `[jobs] hydrated ${loaded} job(s) from disk` +
        (abandoned ? ` (${abandoned} abandoned-on-restart)` : ""),
    );
  }
  return map;
}

const TERMINAL: ReadonlySet<JobStatus> = new Set([
  "complete",
  "complete_with_warnings",
  "incomplete",
  "error",
  "cancelled",
]);

function pruneOldJobs(): void {
  const now = Date.now();
  const cutoff = now - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const [id, job] of jobs) {
    if (!TERMINAL.has(job.status)) continue;
    const ts = job.completedAt
      ? Date.parse(job.completedAt)
      : Date.parse(job.startedAt);
    if (Number.isFinite(ts) && ts < cutoff) {
      jobs.delete(id);
      abortControllers.delete(id);
      deletePersistedJob(id);
      removed++;
    }
  }
  if (removed > 0) {
    console.log(`[jobs] pruned ${removed} job(s) older than ${RETENTION_DAYS}d`);
  }
}

/* ── In-memory state (hydrated once per process) ─────────── */

const globalKey = "__literaryJobsMap_v2";
const cleanupKey = "__literaryJobsCleanupTimer_v2";

const jobs = (
  (globalThis as unknown as { [k: string]: Map<string, JobState> | undefined })[
    globalKey
  ] ??= hydrateFromDisk()
);

const abortControllers = (
  (globalThis as unknown as {
    __literaryJobAbortMap?: Map<string, AbortController>;
  }).__literaryJobAbortMap ??= new Map<string, AbortController>()
);

// Schedule cleanup once per process. Run an immediate prune so a freshly
// hydrated registry doesn't have to wait an hour for stale entries to go.
if (
  !(globalThis as unknown as { [k: string]: NodeJS.Timeout | undefined })[
    cleanupKey
  ]
) {
  pruneOldJobs();
  const timer = setInterval(pruneOldJobs, CLEANUP_INTERVAL_MS);
  // Don't keep the event loop alive just for cleanup.
  if (timer.unref) timer.unref();
  (globalThis as unknown as { [k: string]: NodeJS.Timeout })[cleanupKey] = timer;
}

/* ── Public API (unchanged signatures) ────────────────────── */

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
  persistJob(job);
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
    persistJob(job);
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
    persistJob(job);
  };
}

export function markJobError(id: string, message: string): void {
  const job = jobs.get(id);
  if (!job) return;
  if (job.status === "running") {
    job.status = "error";
    job.error = message;
    job.completedAt = new Date().toISOString();
    persistJob(job);
  }
}
