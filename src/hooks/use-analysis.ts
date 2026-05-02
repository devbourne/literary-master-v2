"use client";

import { useReducer, useCallback, useRef } from "react";
import type {
  PipelineEvent,
  PipelinePhase,
  TeachingMaterial,
  WorkProfile,
  AnnotatedBlock,
} from "@/lib/types";

interface AnalysisState {
  phase: PipelinePhase | "error" | "incomplete";
  statusMessage: string;
  profile: WorkProfile | null;
  blocks: AnnotatedBlock[];
  batchProgress: { done: number; total: number };
  revisedIds: Set<string>;
  synthesisMd: string;
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
  /** v2 Phase A: set when the Finalization Gate emitted "incomplete". */
  incomplete: { reason: string; retryable: boolean } | null;
  error: string | null;
}

type Action =
  | { type: "START" }
  | { type: "STATUS"; phase: PipelinePhase; message: string }
  | { type: "PROFILE"; profile: WorkProfile }
  | { type: "BATCH_START"; batchIndex: number; totalBatches: number }
  | { type: "BATCH_COMPLETE"; blocks: AnnotatedBlock[]; batchIndex: number }
  | { type: "REVISE"; blockId: string }
  | { type: "SYNTHESIS_STREAM"; chunk: string }
  | {
      type: "VERIFY";
      verified: boolean;
      text: string;
      status?: "VERIFIED" | "CORRECTION" | "UNCERTAIN";
      iterations?: number;
      issues?: { section: string; description: string; suggested_fix?: string }[];
    }
  | {
      type: "COMPLETE";
      tm: TeachingMaterial;
      synthesisMd: string;
      warnings?: string[];
      storageId: string;
    }
  | { type: "ERROR"; message: string }
  | { type: "INCOMPLETE"; reason: string; retryable: boolean }
  | { type: "RESET" };

const initialState: AnalysisState = {
  phase: "idle",
  statusMessage: "",
  profile: null,
  blocks: [],
  batchProgress: { done: 0, total: 0 },
  revisedIds: new Set(),
  synthesisMd: "",
  verify: null,
  teachingMaterial: null,
  storageId: null,
  warnings: [],
  incomplete: null,
  error: null,
};

function reducer(state: AnalysisState, action: Action): AnalysisState {
  switch (action.type) {
    case "START":
      return { ...initialState, phase: "profile", statusMessage: "시작..." };
    case "STATUS":
      return { ...state, phase: action.phase, statusMessage: action.message };
    case "PROFILE":
      return { ...state, profile: action.profile };
    case "BATCH_START":
      return {
        ...state,
        batchProgress: { done: action.batchIndex, total: action.totalBatches },
      };
    case "BATCH_COMPLETE":
      return {
        ...state,
        blocks: [...state.blocks, ...action.blocks],
        batchProgress: {
          done: action.batchIndex + 1,
          total: state.batchProgress.total,
        },
      };
    case "REVISE":
      return {
        ...state,
        revisedIds: new Set([...state.revisedIds, action.blockId]),
      };
    case "SYNTHESIS_STREAM":
      return { ...state, synthesisMd: state.synthesisMd + action.chunk };
    case "VERIFY":
      return {
        ...state,
        verify: {
          verified: action.verified,
          text: action.text,
          status: action.status,
          iterations: action.iterations,
          issues: action.issues,
        },
      };
    case "COMPLETE":
      return {
        ...state,
        phase: "done",
        teachingMaterial: action.tm,
        storageId: action.storageId,
        synthesisMd: action.synthesisMd || state.synthesisMd,
        warnings: action.warnings ?? state.warnings,
      };
    case "ERROR":
      return { ...state, phase: "error", error: action.message };
    case "INCOMPLETE":
      return {
        ...state,
        phase: "incomplete",
        incomplete: { reason: action.reason, retryable: action.retryable },
      };
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}

export function useAnalysis() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const abortRef = useRef<AbortController | null>(null);

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
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "START" });

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, sources }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        dispatch({ type: "ERROR", message: `HTTP ${res.status}` });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as PipelineEvent;
            console.log(
              `[SSE] ${event.type}`,
              event.type === "complete" || event.type === "complete_with_warnings"
                ? { storageId: event.storageId }
                : "",
            );
            switch (event.type) {
              case "status":
                dispatch({
                  type: "STATUS",
                  phase: event.phase,
                  message: event.message,
                });
                break;
              case "profile_complete":
                dispatch({ type: "PROFILE", profile: event.profile });
                break;
              case "batch_start":
                dispatch({
                  type: "BATCH_START",
                  batchIndex: event.batchIndex,
                  totalBatches: event.totalBatches,
                });
                break;
              case "batch_complete":
                dispatch({
                  type: "BATCH_COMPLETE",
                  blocks: event.blocks,
                  batchIndex: event.batchIndex,
                });
                break;
              case "revise_one":
                dispatch({ type: "REVISE", blockId: event.blockId });
                break;
              case "synthesis_stream":
                dispatch({ type: "SYNTHESIS_STREAM", chunk: event.chunk });
                break;
              case "verify_complete":
                dispatch({
                  type: "VERIFY",
                  verified: event.verified,
                  text: event.text,
                  status: event.status,
                  iterations: event.iterations,
                  issues: event.issues,
                });
                break;
              case "agent_step":
                // Progress-only; rendered as status message for visibility.
                dispatch({
                  type: "STATUS",
                  phase: "verify",
                  message:
                    `[${event.agent}] iter ${event.iter} · ${event.action}` +
                    (event.status ? ` → ${event.status}` : "") +
                    (event.contextChars ? ` (ctx=${event.contextChars})` : ""),
                });
                break;
              case "complete":
              case "complete_with_warnings": {
                try {
                  const fetchRes = await fetch(
                    `/api/teaching-material/${event.storageId}`,
                  );
                  if (!fetchRes.ok) {
                    dispatch({
                      type: "ERROR",
                      message: `저장된 교재를 불러오지 못했습니다 (HTTP ${fetchRes.status}).`,
                    });
                    break;
                  }
                  const data = (await fetchRes.json()) as {
                    teachingMaterial?: TeachingMaterial;
                  };
                  if (!data.teachingMaterial) {
                    dispatch({
                      type: "ERROR",
                      message: "저장된 교재 응답이 비어 있습니다.",
                    });
                    break;
                  }
                  dispatch({
                    type: "COMPLETE",
                    tm: data.teachingMaterial,
                    synthesisMd: event.synthesisMd,
                    warnings:
                      event.type === "complete_with_warnings"
                        ? event.warnings
                        : [],
                    storageId: event.storageId,
                  });
                } catch (e) {
                  dispatch({
                    type: "ERROR",
                    message:
                      e instanceof Error
                        ? `저장된 교재 가져오기 실패: ${e.message}`
                        : "저장된 교재 가져오기 실패",
                  });
                }
                break;
              }
              case "incomplete":
                dispatch({
                  type: "INCOMPLETE",
                  reason: event.reason,
                  retryable: event.retryable,
                });
                break;
              case "error":
                dispatch({ type: "ERROR", message: event.message });
                break;
            }
          } catch {
            /* skip malformed */
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        dispatch({ type: "ERROR", message: (e as Error).message });
      }
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "RESET" });
  }, []);

  return { state, analyze, reset };
}
