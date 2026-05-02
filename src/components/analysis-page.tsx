"use client";

import Link from "next/link";
import { useState } from "react";
import { useAnalysis } from "@/hooks/use-analysis";
import { InputPanel } from "./input-panel";
import { PiecePicker } from "./piece-picker";
import { PipelineViewer } from "./pipeline-viewer";
import { ReportViewer } from "./report-viewer";
import { ExportButtons } from "./export-buttons";

type Phase = "input" | "picking" | "analyzing" | "complete";

interface PieceInfo {
  title: string;
  index: number;
  wordCount: number;
  preview: string;
}

interface ScanInfo {
  title?: string;
  author?: string;
  pieces: PieceInfo[];
}

export function AnalysisPage() {
  const { state, analyze, reset: resetAnalysis } = useAnalysis();
  const [phase, setPhase] = useState<Phase>("input");
  const [fullText, setFullText] = useState("");
  const [sourceUrl, setSourceUrl] = useState<string | undefined>(undefined);
  const [scanInfo, setScanInfo] = useState<ScanInfo | null>(null);
  const [scanning, setScanning] = useState(false);

  // Extract a piece from full text by finding title boundaries
  function extractPiece(text: string, pieces: PieceInfo[], index: number): string {
    const piece = pieces[index];
    const nextPiece = pieces[index + 1];

    // Find piece title in text (skip TOC — find second occurrence)
    const title = piece.title;
    const firstPos = text.indexOf(title);
    const secondPos = firstPos >= 0 ? text.indexOf(title, firstPos + title.length + 5) : -1;
    const startPos = secondPos >= 0 ? secondPos : (firstPos >= 0 ? firstPos : 0);

    // Find end
    let endPos = text.length;
    if (nextPiece) {
      const nextTitle = nextPiece.title;
      const np = text.indexOf(nextTitle, startPos + 100);
      if (np >= 0) endPos = np;
    }

    return text.slice(startPos, endPos).trim();
  }

  const handleSubmitText = async (text: string, meta?: { sourceUrl?: string }) => {
    setFullText(text);
    setSourceUrl(meta?.sourceUrl);
    setScanning(true);

    try {
      // Send only a sample to scan API
      const sample = text.slice(0, 4000);
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sample, totalLength: text.length }),
      });
      const data = await res.json();

      if (data.error || data.type === "single" || !data.pieces || data.pieces.length <= 1) {
        // Single piece — go directly to analysis. raw == analyzed.
        startAnalysis(text, {
          rawText: text,
          sourceUrl: meta?.sourceUrl,
          sourceTitle: data?.title,
        });
        return;
      }

      // Collection — enrich with client-side text matching
      // Handle both {title: string} objects and plain strings
      const rawPieces: string[] = data.pieces.map((p: string | { title: string }) =>
        typeof p === "string" ? p : p.title
      );
      const pieces: PieceInfo[] = rawPieces.map((title: string, i: number) => {
        const firstPos = text.indexOf(title);
        const secondPos = firstPos >= 0 ? text.indexOf(title, firstPos + title.length + 5) : -1;
        const startPos = secondPos >= 0 ? secondPos : firstPos;

        const nextTitle = rawPieces[i + 1];
        let endPos = text.length;
        if (nextTitle) {
          const np = text.indexOf(nextTitle, (startPos >= 0 ? startPos : 0) + 100);
          if (np >= 0) endPos = np;
        }

        const pieceText = startPos >= 0 ? text.slice(startPos, endPos) : "";
        return {
          title,
          index: i,
          wordCount: pieceText.split(/\s+/).filter(Boolean).length,
          preview: pieceText.slice(0, 200).replace(/\n+/g, " ").trim(),
        };
      });

      setScanInfo({ title: data.title, author: data.author, pieces });
      setPhase("picking");
    } catch {
      startAnalysis(text, { rawText: text, sourceUrl: meta?.sourceUrl });
    } finally {
      setScanning(false);
    }
  };

  const handlePickPiece = (pieceIndex: number) => {
    if (!scanInfo) return;
    const extracted = extractPiece(fullText, scanInfo.pieces, pieceIndex);
    const piece = scanInfo.pieces[pieceIndex];
    startAnalysis(extracted, {
      rawText: fullText,
      sourceUrl,
      sourceTitle: scanInfo.title,
      pieceTitle: piece.title,
      pieceIndex,
    });
  };

  const startAnalysis = (
    text: string,
    sources?: {
      rawText?: string;
      sourceUrl?: string;
      sourceTitle?: string;
      pieceTitle?: string;
      pieceIndex?: number;
    },
  ) => {
    setPhase("analyzing");
    analyze(text, sources);
  };

  const handleReset = () => {
    resetAnalysis();
    setScanInfo(null);
    setFullText("");
    setSourceUrl(undefined);
    setPhase("input");
  };

  const currentPhase = state.phase === "done" ? "complete" : phase;

  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      <header style={{ borderBottom: "1px solid #e5e7eb", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Text Analysis Agent</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            {currentPhase === "input" && "텍스트를 입력하세요"}
            {currentPhase === "picking" && `${scanInfo?.title || "작품집"} — 분석할 작품 선택`}
            {currentPhase === "analyzing" && "분석 진행 중..."}
            {currentPhase === "complete" && "분석 완료"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
            📚 저장된 교재
          </Link>
          {currentPhase !== "input" && (
            <button onClick={handleReset} style={{ padding: "6px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", background: "none" }}>
              처음부터
            </button>
          )}
          {currentPhase === "complete" && (
            <ExportButtons
              report={state.synthesisMd}
              jsonData={state.teachingMaterial}
              teachingMaterial={state.teachingMaterial}
              storageId={state.storageId}
            />
          )}
        </div>
      </header>

      <main style={{ height: "calc(100vh - 65px)", overflow: "auto", padding: 16 }}>
        {currentPhase === "input" && (
          <div style={{ maxWidth: 700, margin: "0 auto" }}>
            <InputPanel onAnalyze={handleSubmitText} disabled={scanning} />
            {scanning && (
              <div style={{ textAlign: "center", padding: 24, color: "#6b7280", fontSize: 14 }}>
                텍스트 구조 분석 중...
              </div>
            )}
          </div>
        )}

        {currentPhase === "picking" && scanInfo && (
          <div style={{ maxWidth: 700, margin: "0 auto" }}>
            <PiecePicker scan={scanInfo} onPick={handlePickPiece} disabled={false} />
          </div>
        )}

        {currentPhase === "analyzing" && (
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <PipelineViewer
              phase={state.phase}
              statusMessage={state.statusMessage}
              profile={state.profile}
              blocks={state.blocks}
              batchProgress={state.batchProgress}
              revisedIds={state.revisedIds}
              synthesisMd={state.synthesisMd}
              verify={state.verify}
              error={state.error}
            />
          </div>
        )}

        {currentPhase === "complete" && (
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <ReportViewer
              teachingMaterial={state.teachingMaterial}
              legacyMarkdown={state.synthesisMd}
              stats={state.teachingMaterial?.stats ?? null}
            />
          </div>
        )}
      </main>
    </div>
  );
}
