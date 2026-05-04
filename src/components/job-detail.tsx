"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JobState } from "@/lib/jobs/registry";

interface Props {
  jobId: string;
}

const TERMINAL_COMPLETE = new Set(["complete", "complete_with_warnings"]);

const PHASE_LABELS: Record<string, string> = {
  idle: "대기",
  profile: "1. 작품 프로파일",
  blocks: "2. 블록 주해 · 번역",
  revise: "3. 재검토",
  synthesis: "4. 종합 보고서",
  verify: "5. 검증",
  done: "완료",
};

const PHASE_ORDER = [
  "profile",
  "blocks",
  "revise",
  "synthesis",
  "verify",
  "done",
];

function phaseIndex(p?: string): number {
  if (!p) return -1;
  return PHASE_ORDER.indexOf(p);
}

function elapsedLabel(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  if (ms < 60_000) return `${Math.round(ms / 1000)}초`;
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}분`;
  return `${Math.floor(ms / 3600_000)}시간 ${Math.floor((ms % 3600_000) / 60_000)}분`;
}

export function JobDetail({ jobId }: Props) {
  const router = useRouter();
  const [job, setJob] = useState<JobState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, forceTick] = useState(0);
  const completedNotifiedRef = useRef(false);

  // Re-render every 5s for "elapsed" label updates even when poll returns
  // unchanged data.
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

  // Poll every 3s.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/jobs/${jobId}`);
        if (cancelled) return;
        if (r.status === 404) {
          setError("작업을 찾을 수 없습니다 (서버 재시작으로 in-memory 상태 손실).");
          return;
        }
        if (!r.ok) {
          setError(`불러오기 실패: HTTP ${r.status}`);
          return;
        }
        const data = (await r.json()) as { job: JobState };
        setJob(data.job);
        setError(null);
        if (
          TERMINAL_COMPLETE.has(data.job.status) &&
          data.job.storageId &&
          !completedNotifiedRef.current
        ) {
          completedNotifiedRef.current = true;
          // Auto-redirect to the saved teaching material after a short pause
          setTimeout(() => {
            router.push(`/saved/${data.job.storageId}`);
          }, 1500);
        }
      } catch (e) {
        if (cancelled) return;
        // tolerate transient
        setError(e instanceof Error ? e.message : String(e));
      }
    };
    void tick();
    const id = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [jobId, router]);

  const handleCancel = async () => {
    if (!confirm("진행 중인 분석을 취소할까요?")) return;
    try {
      await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
    } catch {}
  };

  const isRunning = job?.status === "running";
  const isComplete = job ? TERMINAL_COMPLETE.has(job.status) : false;
  const currentPhaseIdx = phaseIndex(job?.phase);

  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      <header
        style={{
          borderBottom: "1px solid #e5e7eb",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            분석 진행 상황
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            <code>{jobId.slice(0, 8)}…</code>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href="/saved"
            style={{
              padding: "6px 12px",
              fontSize: 13,
              border: "1px solid #d1d5db",
              borderRadius: 6,
              background: "#f9fafb",
              color: "#111",
              textDecoration: "none",
            }}
          >
            ← 저장된 교재
          </Link>
          {isRunning && (
            <button
              onClick={handleCancel}
              style={{
                padding: "6px 12px",
                fontSize: 13,
                border: "1px solid #fca5a5",
                borderRadius: 6,
                background: "#fff",
                color: "#b91c1c",
                cursor: "pointer",
              }}
            >
              취소
            </button>
          )}
        </div>
      </header>

      <main style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
        {error && !job && (
          <div
            style={{
              padding: 16,
              background: "#fee2e2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              color: "#991b1b",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {job && (
          <div>
            <div
              style={{
                marginBottom: 24,
                padding: 16,
                background: isComplete
                  ? "#ecfdf5"
                  : job.status === "error"
                    ? "#fee2e2"
                    : job.status === "cancelled"
                      ? "#fafafa"
                      : "#eff6ff",
                border: `1px solid ${
                  isComplete
                    ? "#a7f3d0"
                    : job.status === "error"
                      ? "#fecaca"
                      : job.status === "cancelled"
                        ? "#e5e7eb"
                        : "#bfdbfe"
                }`,
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: "#374151",
                  marginBottom: 8,
                }}
              >
                <strong>입력</strong>:{" "}
                {job.sources?.pieceTitle ||
                  job.sources?.sourceTitle ||
                  job.inputPreview}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                {job.totalChars.toLocaleString()}자 · 시작 {new Date(job.startedAt).toLocaleString("ko-KR")} · 경과 {elapsedLabel(job.startedAt)}
              </div>
              {isComplete && job.storageId && (
                <div style={{ marginTop: 12 }}>
                  <Link
                    href={`/saved/${job.storageId}`}
                    style={{
                      display: "inline-block",
                      padding: "8px 16px",
                      background: "#10b981",
                      color: "#fff",
                      borderRadius: 6,
                      textDecoration: "none",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    ✓ 분석 결과 보기 →
                  </Link>
                  {job.warnings && job.warnings.length > 0 && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        color: "#b45309",
                      }}
                    >
                      ⚠ 경고 {job.warnings.length}건
                    </div>
                  )}
                </div>
              )}
              {job.status === "error" && job.error && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    color: "#991b1b",
                    fontFamily: "monospace",
                  }}
                >
                  {job.error}
                </div>
              )}
              {job.status === "incomplete" && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    color: "#92400e",
                  }}
                >
                  분석이 완결되지 않았습니다 ({job.reason ?? "unknown"}).
                </div>
              )}
              {job.status === "cancelled" && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    color: "#4b5563",
                  }}
                >
                  사용자가 취소했습니다.
                </div>
              )}
            </div>

            {/* Phase progress bar */}
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6, 1fr)",
                  gap: 4,
                  marginBottom: 12,
                }}
              >
                {PHASE_ORDER.map((p, i) => {
                  const reached = currentPhaseIdx >= 0 && i <= currentPhaseIdx;
                  const current =
                    currentPhaseIdx >= 0 && i === currentPhaseIdx && isRunning;
                  return (
                    <div
                      key={p}
                      style={{
                        height: 6,
                        background: reached
                          ? current
                            ? "#3b82f6"
                            : "#10b981"
                          : "#e5e7eb",
                        borderRadius: 3,
                      }}
                    />
                  );
                })}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "#6b7280",
                }}
              >
                {PHASE_ORDER.map((p) => (
                  <span key={p}>{PHASE_LABELS[p].replace(/^\d+\.\s*/, "")}</span>
                ))}
              </div>
            </div>

            {/* Current phase detail */}
            {isRunning && job.phase && (
              <div
                style={{
                  padding: 16,
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#3b82f6",
                    letterSpacing: "0.05em",
                    marginBottom: 6,
                  }}
                >
                  현재 단계
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: "#111827",
                    marginBottom: 4,
                  }}
                >
                  {PHASE_LABELS[job.phase] ?? job.phase}
                </div>
                {job.statusMessage && (
                  <div
                    style={{
                      fontSize: 13,
                      color: "#4b5563",
                      fontFamily: "monospace",
                    }}
                  >
                    {job.statusMessage}
                  </div>
                )}
              </div>
            )}

            {/* Batch progress */}
            {job.batchProgress && job.batchProgress.total > 0 && (
              <div
                style={{
                  padding: 16,
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <span style={{ fontSize: 13, color: "#374151" }}>
                    블록 배치 진행
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                    {job.batchProgress.done}/{job.batchProgress.total}
                  </span>
                </div>
                <div
                  style={{
                    height: 8,
                    background: "#e5e7eb",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(job.batchProgress.done / job.batchProgress.total) * 100}%`,
                      background: "#3b82f6",
                      transition: "width 300ms ease",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Verify status */}
            {job.verifyStatus && (
              <div
                style={{
                  padding: 16,
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    color: "#6b7280",
                    marginBottom: 4,
                  }}
                >
                  Verify 상태
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color:
                      job.verifyStatus === "VERIFIED"
                        ? "#047857"
                        : job.verifyStatus === "CORRECTION"
                          ? "#b45309"
                          : "#991b1b",
                  }}
                >
                  {job.verifyStatus}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
