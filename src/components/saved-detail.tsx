"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { TeachingMaterial } from "@/lib/types";
import { ReportViewer } from "./report-viewer";
import { ExportButtons } from "./export-buttons";

type LoadState =
  | { status: "loading" }
  | { status: "ok"; tm: TeachingMaterial }
  | { status: "not_found" }
  | { status: "error"; message: string };

export function SavedDetail({ id }: { id: string }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(`/api/teaching-material/${id}`);
        if (cancelled) return;
        if (res.status === 404) {
          setState({ status: "not_found" });
          return;
        }
        if (!res.ok) {
          setState({ status: "error", message: `HTTP ${res.status}` });
          return;
        }
        const data = (await res.json()) as { teachingMaterial?: TeachingMaterial };
        if (!data.teachingMaterial) {
          setState({ status: "not_found" });
          return;
        }
        setState({ status: "ok", tm: data.teachingMaterial });
      } catch (e) {
        if (cancelled) return;
        setState({
          status: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleDelete = async () => {
    if (state.status !== "ok") return;
    if (!confirm(`"${state.tm.metadata.title}" 을(를) 삭제할까요?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/teaching-material/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(`삭제 실패: ${data?.error ?? `HTTP ${res.status}`}`);
        return;
      }
      router.push("/saved");
    } catch (e) {
      alert(`삭제 오류: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDeleting(false);
    }
  };

  const tm = state.status === "ok" ? state.tm : null;

  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      <header
        style={{
          borderBottom: "1px solid #e5e7eb",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            {tm?.metadata.title ?? "저장된 교재"}
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            {tm
              ? `${tm.metadata.author} · ${tm.blocks.length}개 블록`
              : state.status === "loading"
                ? "불러오는 중..."
                : state.status === "not_found"
                  ? "존재하지 않는 교재"
                  : "오류"}
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
              cursor: "pointer",
              background: "none",
              color: "#111",
              textDecoration: "none",
            }}
          >
            ← 목록
          </Link>
          {tm && (
            <>
              <ExportButtons
                report={tm.synthesis_markdown}
                jsonData={tm}
                teachingMaterial={tm}
                storageId={id}
              />
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: "6px 12px",
                  fontSize: 13,
                  color: "#b91c1c",
                  border: "1px solid #fca5a5",
                  borderRadius: 6,
                  background: "#fef2f2",
                  cursor: deleting ? "wait" : "pointer",
                }}
              >
                {deleting ? "..." : "삭제"}
              </button>
            </>
          )}
        </div>
      </header>

      <main style={{ padding: 16, maxWidth: 1000, margin: "0 auto" }}>
        {state.status === "loading" && (
          <p style={{ color: "#6b7280" }}>불러오는 중...</p>
        )}
        {state.status === "not_found" && (
          <div
            style={{
              padding: 16,
              background: "#fef3c7",
              border: "1px solid #fde68a",
              borderRadius: 8,
              color: "#92400e",
              fontSize: 13,
            }}
          >
            ID <code>{id}</code> 에 해당하는 교재를 찾을 수 없습니다.
          </div>
        )}
        {state.status === "error" && (
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
            불러오기 실패: {state.message}
          </div>
        )}
        {state.status === "ok" && (
          <div>
            {tm?.sources && (tm.sources.source_url || tm.sources.source_title || tm.sources.piece_title) && (
              <div
                style={{
                  padding: 12,
                  marginBottom: 16,
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#4b5563",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 16,
                }}
              >
                {tm.sources.source_url && (
                  <span>
                    <strong>출처:</strong>{" "}
                    <a
                      href={tm.sources.source_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#1d4ed8" }}
                    >
                      {tm.sources.source_url}
                    </a>
                  </span>
                )}
                {tm.sources.source_title && (
                  <span>
                    <strong>컬렉션:</strong> {tm.sources.source_title}
                  </span>
                )}
                {tm.sources.piece_title && (
                  <span>
                    <strong>선택 작품:</strong> {tm.sources.piece_title}
                  </span>
                )}
              </div>
            )}
            <ReportViewer
              teachingMaterial={tm}
              legacyMarkdown={tm!.synthesis_markdown}
              stats={tm!.stats ?? null}
            />
          </div>
        )}
      </main>
    </div>
  );
}
