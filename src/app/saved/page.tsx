"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface SavedItem {
  id: string;
  title: string;
  author: string;
  savedAt: string;
  generatedAt: string;
  blockCount: number;
  verified: boolean;
  sizeBytes: number;
}

type LoadState =
  | { status: "loading" }
  | { status: "ok"; items: SavedItem[] }
  | { status: "disabled" }
  | { status: "error"; message: string };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 102.4) / 10} KB`;
  return `${Math.round(n / (1024 * 102.4)) / 10} MB`;
}

function formatDate(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SavedListPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/teaching-material");
        if (cancelled) return;
        if (res.status === 403) {
          setState({ status: "disabled" });
          return;
        }
        if (!res.ok) {
          setState({ status: "error", message: `HTTP ${res.status}` });
          return;
        }
        const data = (await res.json()) as { items?: SavedItem[] };
        setState({ status: "ok", items: data.items ?? [] });
      } catch (e) {
        if (cancelled) return;
        setState({
          status: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  const reload = () => setReloadTick((n) => n + 1);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" 을(를) 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/teaching-material/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(`삭제 실패: ${data?.error ?? `HTTP ${res.status}`}`);
        return;
      }
      reload();
    } catch (e) {
      alert(`삭제 오류: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusyId(null);
    }
  };

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
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>저장된 교재</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            서버에 저장된 분석 결과를 열람하고 관리합니다
          </p>
        </div>
        <Link
          href="/"
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
          ← 새 분석
        </Link>
      </header>

      <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
        {state.status === "loading" && (
          <p style={{ color: "#6b7280" }}>불러오는 중...</p>
        )}

        {state.status === "disabled" && (
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
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              목록 API가 비활성화되어 있습니다 (403)
            </div>
            <div>
              production 모드에서는 기본적으로 차단됩니다. 활성화하려면 서버를
              <code
                style={{
                  padding: "2px 6px",
                  margin: "0 4px",
                  background: "#fff",
                  borderRadius: 4,
                }}
              >
                TEACHING_MATERIAL_LIST_ENABLED=true
              </code>
              환경변수로 시작하세요.
            </div>
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
            목록 불러오기 실패: {state.message}
          </div>
        )}

        {state.status === "ok" && state.items.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: 48,
              color: "#6b7280",
              fontSize: 14,
            }}
          >
            아직 저장된 교재가 없습니다.
          </div>
        )}

        {state.status === "ok" && state.items.length > 0 && (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", textAlign: "left" }}>
                <th style={{ padding: "10px 8px", fontWeight: 600 }}>제목</th>
                <th style={{ padding: "10px 8px", fontWeight: 600 }}>작가</th>
                <th style={{ padding: "10px 8px", fontWeight: 600 }}>저장 시각</th>
                <th style={{ padding: "10px 8px", fontWeight: 600 }}>블록</th>
                <th style={{ padding: "10px 8px", fontWeight: 600 }}>검증</th>
                <th style={{ padding: "10px 8px", fontWeight: 600 }}>크기</th>
                <th style={{ padding: "10px 8px", fontWeight: 600, textAlign: "right" }}>
                  작업
                </th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((it) => (
                <tr
                  key={it.id}
                  style={{ borderBottom: "1px solid #f3f4f6" }}
                >
                  <td style={{ padding: "10px 8px" }}>
                    <Link
                      href={`/saved/${it.id}`}
                      style={{
                        color: "#1a1a1a",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      {it.title}
                    </Link>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                      <code>{it.id.slice(0, 8)}…</code>
                    </div>
                  </td>
                  <td style={{ padding: "10px 8px", color: "#374151" }}>
                    {it.author}
                  </td>
                  <td style={{ padding: "10px 8px", color: "#6b7280" }}>
                    {formatDate(it.savedAt)}
                  </td>
                  <td style={{ padding: "10px 8px", color: "#6b7280" }}>
                    {it.blockCount}
                  </td>
                  <td style={{ padding: "10px 8px" }}>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: it.verified ? "#d1fae5" : "#fef3c7",
                        color: it.verified ? "#065f46" : "#92400e",
                      }}
                    >
                      {it.verified ? "VERIFIED" : "CHECK"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 8px", color: "#6b7280" }}>
                    {formatBytes(it.sizeBytes)}
                  </td>
                  <td
                    style={{
                      padding: "10px 8px",
                      textAlign: "right",
                    }}
                  >
                    <Link
                      href={`/saved/${it.id}`}
                      style={{
                        marginRight: 8,
                        fontSize: 12,
                        color: "#1a1a1a",
                        textDecoration: "none",
                        padding: "4px 10px",
                        border: "1px solid #d1d5db",
                        borderRadius: 4,
                        background: "#f9fafb",
                      }}
                    >
                      보기
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(it.id, it.title)}
                      disabled={busyId === it.id}
                      style={{
                        fontSize: 12,
                        color: "#b91c1c",
                        padding: "4px 10px",
                        border: "1px solid #fca5a5",
                        borderRadius: 4,
                        background: "#fef2f2",
                        cursor: busyId === it.id ? "wait" : "pointer",
                      }}
                    >
                      {busyId === it.id ? "..." : "삭제"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}
