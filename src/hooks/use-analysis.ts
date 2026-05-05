"use client";

import { useReducer, useCallback, useRef, useEffect } from "react";
import type {
  PipelinePhase,
  TeachingMaterial,
  WorkProfile,
  AnnotatedBlock,
} from "@/lib/types";
import type { JobState } from "@/lib/jobs/registry";

interface AnalysisState {
  phase: PipelinePhase | "error" | "incomplete";
  statusMessage: string;
  profile: WorkProfile | null;
  blocks: AnnotatedBlock[];
  batchProgress: { done: number; total: number };
  revisedIds: Set<string>;
  verify: {
    verified: boolean;
    text: string;
    status?: "VERIFIED" | "CORRECTION" | "UNCERTAIN";
    iterations?: number;
    issues?: { section: string; description: string; suggested_fix?: string }[];
  } | null;
  teachingMaterial: TeachingMaterial | null;
  storageId: string | null;
  warnings: string[];
  error: string | null;
  jobId: string | null;
  incomplete: { reason: string; retryable: boolean } | null;
}

type Action =
  | { type: "START"; jobId: string }
  | { type: "STATUS"; phase: PipelinePhase; message: string }
  | { type: "BATCH"; done: number; total: number }
  | {
      type: "VERIFY";
      status: "VERIFIED" | "CORRECTION" | "UNCERTAIN";
    }
  | {
      type: "COMPLETE";
      tm: TeachingMaterial;
      warnings: string[];
      storageId: string;
    }
  | { type: "INCOMPLETE"; reason: string; retryable: boolean }
  | { type: "ERROR"; message: string }
  | { type: "RESET" };

const initialState: AnalysisState = {
  phase: "idle",
  statusMessage: "",
  profile: null,
  blocks: [],
  batchProgress: { done: 0, total: 0 },
  revisedIds: new Set(),
  verify: null,
  teachingMaterial: null,
  storageId: null,
  warnings: [],
  error: null,
  jobId: null,
  incomplete: null,
};

function reducer(state: AnalysisState, action: Action): AnalysisState {
  switch (action.type) {
    case "START":
      return {
        ...initialState,
        phase: "profile",
        statusMessage: "분석을 백그라운드로 실행 중입니다...",
        jobId: action.jobId,
      };
    case "STATUS":
      return { ...state, phase: action.phase, statusMessage: action.message };
    case "BATCH":
      return {
        ...state,
        batchProgress: { done: action.done, total: action.total },
      };
    case "VERIFY":
      return {
        ...state,
        verify: {
          verified: action.status === "VERIFIED",
          text: "",
          status: action.status,
        },
      };
    case "COMPLETE":
      return {
        ...state,
        phase: "done",
        teachingMaterial: action.tm,
        storageId: action.storageId,
        warnings: action.warnings,
      };
    case "INCOMPLETE":
      return {
        ...state,
        phase: "incomplete",
        incomplete: { reason: action.reason, retryable: action.retryable },
      };
    case "ERROR":
      return { ...state, phase: "error", error: action.message };
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}

const POLL_INTERVAL_MS = 3000;

function maybeRequestNotificationPermission() {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

function fireCompletionNotification(tm: TeachingMaterial, storageId: string) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const title = tm.metadata.title || "분석 완료";
  const n = new Notification(title, {
    body: "교재가 준비되었습니다. 클릭하여 열기.",
    tag: storageId,
  });
  n.onclick = () => {
    window.focus();
    window.location.href = `/saved/${storageId}`;
  };
}

export function useAnalysis() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const analyze = useCallback(
    async (
      text: string,
      sources?: {
        rawText?: string;
        sourceUrl?: string;
        sourceTitle?: string;
        pieceTitle?: string;
        pieceIndex?: number;
      },
    ) => {
      stopPolling();
      maybeRequestNotificationPermission();

      let res: Response;
      try {
        res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, sources }),
        });
      } catch (e) {
        dispatch({
          type: "ERROR",
          message: e instanceof Error ? e.message : String(e),
        });
        return;
      }
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) msg = body.error;
        } catch {}
        dispatch({ type: "ERROR", message: msg });
        return;
      }
      const body = (await res.json()) as { jobId: string };
      jobIdRef.current = body.jobId;
      dispatch({ type: "START", jobId: body.jobId });

      let lastPhase: string | undefined;
      let lastBatchKey: string | undefined;
      let lastVerifyStatus: string | undefined;
      let terminal = false;

      const tick = async () => {
        if (terminal) {
          stopPolling();
          return;
        }
        const id = jobIdRef.current;
        if (!id) return;
        try {
          const r = await fetch(`/api/jobs/${id}`);
          if (!r.ok) {
            // Single failure tolerated; persistent failure caught below.
            return;
          }
          const data = (await r.json()) as { job: JobState };
          const job = data.job;
          if (
            job.phase &&
            job.statusMessage &&
            (job.phase !== lastPhase || job.statusMessage)
          ) {
            lastPhase = job.phase;
            dispatch({
              type: "STATUS",
              phase: job.phase,
              message: job.statusMessage,
            });
          }
          if (job.batchProgress) {
            const k = `${job.batchProgress.done}/${job.batchProgress.total}`;
            if (k !== lastBatchKey) {
              lastBatchKey = k;
              dispatch({
                type: "BATCH",
                done: job.batchProgress.done,
                total: job.batchProgress.total,
              });
            }
          }
          if (job.verifyStatus && job.verifyStatus !== lastVerifyStatus) {
            lastVerifyStatus = job.verifyStatus;
            dispatch({ type: "VERIFY", status: job.verifyStatus });
          }
          if (
            job.status === "complete" ||
            job.status === "complete_with_warnings"
          ) {
            terminal = true;
            stopPolling();
            if (!job.storageId) {
              dispatch({
                type: "ERROR",
                message: "완료 응답에 storageId 없음",
              });
              return;
            }
            try {
              const tmRes = await fetch(
                `/api/teaching-material/${job.storageId}`,
              );
              if (!tmRes.ok) {
                dispatch({
                  type: "ERROR",
                  message: `교재를 불러오지 못했습니다 (HTTP ${tmRes.status}).`,
                });
                return;
              }
              const tmBody = (await tmRes.json()) as {
                teachingMaterial?: TeachingMaterial;
              };
              if (!tmBody.teachingMaterial) {
                dispatch({ type: "ERROR", message: "교재 응답이 비어 있음" });
                return;
              }
              dispatch({
                type: "COMPLETE",
                tm: tmBody.teachingMaterial,
                storageId: job.storageId,
                warnings: job.warnings ?? [],
              });
              fireCompletionNotification(
                tmBody.teachingMaterial,
                job.storageId,
              );
            } catch (e) {
              dispatch({
                type: "ERROR",
                message:
                  e instanceof Error
                    ? `교재 가져오기 실패: ${e.message}`
                    : "교재 가져오기 실패",
              });
            }
          } else if (job.status === "incomplete") {
            terminal = true;
            stopPolling();
            dispatch({
              type: "INCOMPLETE",
              reason: job.reason ?? "incomplete",
              retryable: true,
            });
          } else if (job.status === "error") {
            terminal = true;
            stopPolling();
            dispatch({
              type: "ERROR",
              message: job.error ?? "분석 중 오류",
            });
          } else if (job.status === "cancelled") {
            terminal = true;
            stopPolling();
            dispatch({ type: "ERROR", message: "취소됨" });
          }
        } catch {
          // single tick failure tolerated; loop continues
        }
      };

      // Kick once immediately so UI doesn't sit blank for POLL_INTERVAL_MS
      void tick();
      pollRef.current = setInterval(tick, POLL_INTERVAL_MS);
    },
    [stopPolling],
  );

  const reset = useCallback(() => {
    stopPolling();
    if (jobIdRef.current) {
      // Best-effort cancel server-side
      void fetch(`/api/jobs/${jobIdRef.current}`, { method: "DELETE" }).catch(
        () => {},
      );
    }
    jobIdRef.current = null;
    dispatch({ type: "RESET" });
  }, [stopPolling]);

  return { state, analyze, reset };
}
