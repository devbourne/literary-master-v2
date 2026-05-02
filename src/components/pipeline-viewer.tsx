"use client";

import { useEffect, useRef } from "react";
import type { PipelinePhase, WorkProfile, AnnotatedBlock } from "@/lib/types";

interface Props {
  phase: PipelinePhase | "error" | "incomplete";
  statusMessage: string;
  profile: WorkProfile | null;
  blocks: AnnotatedBlock[];
  batchProgress: { done: number; total: number };
  revisedIds: Set<string>;
  synthesisMd: string;
  verify: { verified: boolean; text: string } | null;
  error: string | null;
}

const PHASE_LABELS: Record<string, string> = {
  idle: "대기",
  profile: "1. 작품 프로파일",
  blocks: "2. 블록 주해 · 번역",
  revise: "3. 재검토",
  synthesis: "4. 종합 보고서",
  verify: "5. 검증",
  done: "완료",
  error: "오류",
};

export function PipelineViewer(props: Props) {
  const {
    phase,
    statusMessage,
    profile,
    blocks,
    batchProgress,
    revisedIds,
    synthesisMd,
    verify,
    error,
  } = props;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && (
        <div
          style={{
            padding: 12,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            fontSize: 13,
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      )}

      {/* Phase indicator */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["profile", "blocks", "revise", "synthesis", "verify", "done"].map(
          (p) => {
            const active = phase === p;
            const past =
              ["profile", "blocks", "revise", "synthesis", "verify", "done"].indexOf(phase) >
              ["profile", "blocks", "revise", "synthesis", "verify", "done"].indexOf(p);
            return (
              <div
                key={p}
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  borderRadius: 12,
                  background: active ? "#3b82f6" : past ? "#dcfce7" : "#f3f4f6",
                  color: active ? "#fff" : past ? "#166534" : "#6b7280",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {PHASE_LABELS[p]}
              </div>
            );
          }
        )}
      </div>

      {statusMessage && (
        <div style={{ fontSize: 13, color: "#6b7280" }}>{statusMessage}</div>
      )}

      {/* Profile card */}
      {profile && (
        <ProfileCard profile={profile} />
      )}

      {/* Block grid */}
      {batchProgress.total > 0 && (
        <BlockGrid
          blocks={blocks}
          batchDone={batchProgress.done}
          batchTotal={batchProgress.total}
          revisedIds={revisedIds}
        />
      )}

      {/* Synthesis streaming — JSON output is parsed at end, show progress only */}
      {phase === "synthesis" && (
        <div
          style={{
            padding: "10px 14px",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            fontSize: 13,
            background: "#faf5e8",
            color: "#5c4f3f",
            fontStyle: "italic",
          }}
        >
          종합 분석 에세이를 구조화된 JSON으로 작성하고 있습니다…
        </div>
      )}
      {/* Legacy markdown support if any chunk is captured */}
      {synthesisMd && phase !== "synthesis" && (
        <SynthesisPreview md={synthesisMd} active={false} />
      )}

      {/* Verify */}
      {verify && (
        <div
          style={{
            padding: 12,
            background: verify.verified ? "#f0fdf4" : "#fef3c7",
            border: "1px solid " + (verify.verified ? "#bbf7d0" : "#fde68a"),
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <strong>{verify.verified ? "✅ 검증 통과" : "⚠️ 검증 경고"}</strong>
          <div style={{ marginTop: 4, fontSize: 12, color: "#555" }}>
            {verify.text.slice(0, 200)}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileCard({ profile }: { profile: WorkProfile }) {
  return (
    <div
      style={{
        padding: 12,
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        fontSize: 12,
        background: "#fafafa",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
        📚 {profile.title} <span style={{ color: "#6b7280", fontWeight: 400 }}>by {profile.author}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 12px", fontSize: 12 }}>
        <span style={{ color: "#9ca3af" }}>주제:</span>
        <span>{profile.themes.slice(0, 3).join(" · ")}</span>
        <span style={{ color: "#9ca3af" }}>인물:</span>
        <span>{profile.characters.map((c) => c.name).slice(0, 5).join(", ")}</span>
        <span style={{ color: "#9ca3af" }}>반전:</span>
        <span>{profile.twist.what.slice(0, 100)}...</span>
      </div>
    </div>
  );
}

function BlockGrid({
  blocks,
  batchDone,
  batchTotal,
  revisedIds,
}: {
  blocks: AnnotatedBlock[];
  batchDone: number;
  batchTotal: number;
  revisedIds: Set<string>;
}) {
  return (
    <div>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>
        블록 진행: {blocks.length}개 완료 / 배치 {batchDone}/{batchTotal}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 3,
          padding: 8,
          background: "#fafafa",
          border: "1px solid #e5e7eb",
          borderRadius: 6,
          maxHeight: 120,
          overflow: "auto",
        }}
      >
        {blocks.map((b) => {
          const flagged = b.annotations.flag_for_revision;
          const revised = revisedIds.has(b.blockId);
          const bg = revised ? "#8b5cf6" : flagged ? "#f59e0b" : "#22c55e";
          return (
            <div
              key={b.blockId}
              title={`${b.blockId}${flagged ? " (flagged)" : ""}${revised ? " (revised)" : ""}`}
              style={{
                width: 16,
                height: 16,
                background: bg,
                borderRadius: 2,
                cursor: "pointer",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function SynthesisPreview({ md, active }: { md: string; active: boolean }) {
  const scrollRef = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (scrollRef.current && active) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [md, active]);
  return (
    <div>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
        종합 보고서 생성 중... ({md.length}자)
      </div>
      <pre
        ref={scrollRef}
        style={{
          margin: 0,
          padding: 8,
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 6,
          fontSize: 11,
          fontFamily: "monospace",
          whiteSpace: "pre-wrap",
          maxHeight: 200,
          overflow: "auto",
          color: "#374151",
        }}
      >
        {md.slice(-3000)}
      </pre>
    </div>
  );
}
