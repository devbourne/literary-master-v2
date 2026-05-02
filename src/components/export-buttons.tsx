"use client";

import { useState } from "react";
import type { TeachingMaterial } from "@/lib/types";

interface Props {
  report: string;
  jsonData: unknown;
  teachingMaterial?: TeachingMaterial | null;
  storageId?: string | null;
}

export function ExportButtons({
  report,
  jsonData,
  teachingMaterial,
  storageId,
}: Props) {
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState("");

  const download = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async () => {
    if (!teachingMaterial) return;
    setGenerating(true);
    setErr("");
    try {
      const res = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teachingMaterial }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || "PDF 생성 실패");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${teachingMaterial.metadata.title}-교재.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const btnStyle = {
    padding: "6px 12px",
    fontSize: 13,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    cursor: "pointer" as const,
    background: "#f9fafb",
  };

  const pdfEnabled = !!teachingMaterial && !generating;
  const pdfBtnStyle: React.CSSProperties = {
    ...btnStyle,
    background: teachingMaterial ? "#1a1a1a" : "#e5e7eb",
    color: teachingMaterial ? "#fff" : "#9ca3af",
    border: "1px solid " + (teachingMaterial ? "#1a1a1a" : "#d1d5db"),
    fontWeight: 600,
    cursor: pdfEnabled ? "pointer" : "not-allowed",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={btnStyle} onClick={() => download(report, "report.md", "text/markdown")}>MD</button>
        <button type="button" style={btnStyle} onClick={() => download(JSON.stringify(jsonData, null, 2), "data.json", "application/json")}>JSON</button>
        {teachingMaterial && (
          <button type="button" style={btnStyle} onClick={() => download(JSON.stringify(teachingMaterial, null, 2), "teaching-material.json", "application/json")}>
            교재 JSON
          </button>
        )}
        <button
          type="button"
          style={pdfBtnStyle}
          onClick={downloadPdf}
          disabled={!teachingMaterial || generating}
        >
          {generating ? "생성 중..." : "📄 PDF 교재 다운로드"}
        </button>
      </div>
      {storageId && (
        <span style={{ fontSize: 12, color: "#10b981" }}>
          자동 저장됨: <code>{storageId}</code>
        </span>
      )}
      {err && <span style={{ fontSize: 12, color: "#ef4444" }}>{err}</span>}
    </div>
  );
}
