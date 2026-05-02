"use client";

import { useState } from "react";

interface InputPanelProps {
  onAnalyze: (text: string, meta?: { sourceUrl?: string }) => void;
  disabled: boolean;
}

// Mode selector removed — fiction-only for now

export function InputPanel({ onAnalyze, disabled }: InputPanelProps) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  // Tracks the URL that produced the current `text`, so onAnalyze can persist it.
  const [fetchedUrl, setFetchedUrl] = useState<string | undefined>(undefined);
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState("");
  const [tab, setTab] = useState<"paste" | "file" | "url">("paste");

  const handleFetchUrl = async () => {
    setFetching(true);
    setFetchMsg("");
    try {
      const res = await fetch("/api/fetch-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.error) {
        setFetchMsg("Error: " + data.error);
      } else {
        setText(data.text);
        setFetchedUrl(url);
        setTab("paste");
        setFetchMsg(`${data.charCount.toLocaleString()}자 로드 완료`);
      }
    } catch (e) {
      setFetchMsg("Error: " + (e as Error).message);
    } finally {
      setFetching(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) {
        setText(content);
        setFetchedUrl(undefined);
        setTab("paste");
      }
    };
    reader.readAsText(file);
  };

  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const tabStyle = (active: boolean) => ({
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: active ? 700 : 400,
    color: active ? "#111" : "#6b7280",
    background: "none",
    border: "none",
    borderBottom: active ? "2px solid #111" : "2px solid transparent",
    cursor: "pointer" as const,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb" }}>
        <button type="button" onClick={() => setTab("paste")} style={tabStyle(tab === "paste")}>붙여넣기</button>
        <button type="button" onClick={() => setTab("file")} style={tabStyle(tab === "file")}>파일</button>
        <button type="button" onClick={() => setTab("url")} style={tabStyle(tab === "url")}>URL</button>
      </div>

      {/* Tab Content */}
      {tab === "paste" && (
        <textarea
          placeholder="분석할 소설/단편 텍스트를 붙여넣으세요..."
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            // Manual edits invalidate the fetched-URL attribution.
            setFetchedUrl(undefined);
          }}
          style={{ width: "100%", minHeight: 300, padding: 12, fontSize: 13, fontFamily: "monospace", border: "1px solid #d1d5db", borderRadius: 8, resize: "vertical", outline: "none", boxSizing: "border-box" }}
        />
      )}

      {tab === "file" && (
        <div style={{ border: "2px dashed #d1d5db", borderRadius: 8, padding: 32, textAlign: "center" }}>
          <input type="file" accept=".txt" onChange={handleFile} style={{ display: "none" }} id="fu" />
          <label htmlFor="fu" style={{ cursor: "pointer", color: "#6b7280" }}>클릭하여 .txt 파일 선택</label>
        </div>
      )}

      {tab === "url" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="url"
              placeholder="https://www.gutenberg.org/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{ flex: 1, padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, outline: "none" }}
            />
            <button
              type="button"
              onClick={handleFetchUrl}
              disabled={!url || fetching}
              style={{ padding: "8px 16px", fontSize: 13, borderRadius: 6, border: "1px solid #d1d5db", cursor: "pointer", background: "#f9fafb" }}
            >
              {fetching ? "..." : "가져오기"}
            </button>
          </div>
          {fetchMsg && <p style={{ fontSize: 13, color: fetchMsg.startsWith("Error") ? "#ef4444" : "#6b7280", margin: 0 }}>{fetchMsg}</p>}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#6b7280" }}>
          {text ? `${charCount.toLocaleString()}자 / ${wordCount.toLocaleString()}단어` : "텍스트를 입력하세요"}
        </span>
        <button
          type="button"
          onClick={() => onAnalyze(text, { sourceUrl: fetchedUrl })}
          disabled={disabled || text.length === 0}
          style={{
            padding: "10px 24px",
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 8,
            border: "none",
            cursor: text.length > 0 && !disabled ? "pointer" : "not-allowed",
            background: text.length > 0 && !disabled ? "#111" : "#e5e7eb",
            color: text.length > 0 && !disabled ? "#fff" : "#9ca3af",
          }}
        >
          {disabled ? "분석 중..." : "분석 시작"}
        </button>
      </div>
    </div>
  );
}
