"use client";

import ReactMarkdown from "react-markdown";
import { useState } from "react";
import type { PipelineStats, TeachingMaterial } from "@/lib/types";
import { SynthesisView } from "./synthesis-view";

interface Props {
  teachingMaterial: TeachingMaterial | null;
  legacyMarkdown: string;
  stats: PipelineStats | null;
}

export function ReportViewer({ teachingMaterial, legacyMarkdown, stats }: Props) {
  const [view, setView] = useState<"report" | "raw">("report");

  const tabStyle = (active: boolean) => ({
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: active ? 700 : 400,
    background: active ? "#111" : "transparent",
    color: active ? "#fff" : "#374151",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    cursor: "pointer" as const,
  });

  const hasStructured =
    !!teachingMaterial?.synthesis &&
    (teachingMaterial.synthesis.thesis_ko.length > 0 ||
      teachingMaterial.synthesis.overview_essay_ko.length > 0 ||
      teachingMaterial.synthesis.character_readings.length > 0 ||
      teachingMaterial.synthesis.plot_reading_ko.length > 0 ||
      teachingMaterial.synthesis.twist_reading?.thesis_ko.length > 0 ||
      teachingMaterial.synthesis.symbolism_readings.length > 0 ||
      teachingMaterial.synthesis.reading_guide_ko.length > 0);

  const rawText = hasStructured
    ? JSON.stringify(teachingMaterial!.synthesis, null, 2)
    : legacyMarkdown;

  return (
    <div>
      {stats && (
        <div
          style={{
            display: "flex",
            gap: 16,
            fontSize: 13,
            color: "#6b7280",
            marginBottom: 12,
          }}
        >
          <span>{stats.totalTokens.toLocaleString()} tokens</span>
          <span>{stats.totalTimeS}s</span>
          <span>avg {stats.avgTokS} tok/s</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setView("report")}
          style={tabStyle(view === "report")}
        >
          보고서
        </button>
        <button
          type="button"
          onClick={() => setView("raw")}
          style={tabStyle(view === "raw")}
        >
          {hasStructured ? "JSON" : "Raw"}
        </button>
      </div>

      {view === "report" ? (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 32,
            background: "#fffdf8",
          }}
        >
          {hasStructured ? (
            <SynthesisView synthesis={teachingMaterial!.synthesis!} />
          ) : legacyMarkdown ? (
            <div style={{ fontSize: 14, lineHeight: 1.7 }}>
              <ReactMarkdown>{legacyMarkdown}</ReactMarkdown>
            </div>
          ) : (
            <div style={{ color: "#6b7280", fontStyle: "italic" }}>
              아직 종합 분석이 없습니다.
            </div>
          )}
        </div>
      ) : (
        <pre
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 16,
            fontSize: 12,
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            maxHeight: 600,
            overflow: "auto",
          }}
        >
          {rawText}
        </pre>
      )}
    </div>
  );
}
