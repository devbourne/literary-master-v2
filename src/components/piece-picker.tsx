"use client";

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

interface Props {
  scan: ScanInfo;
  onPick: (index: number) => void;
  disabled: boolean;
}

export function PiecePicker({ scan, onPick, disabled }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ padding: "16px 0", borderBottom: "1px solid #e5e7eb" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
          {scan.title || "작품 목록"}
        </h2>
        {scan.author && <p style={{ fontSize: 14, color: "#6b7280", margin: "4px 0 0" }}>by {scan.author}</p>}
        <p style={{ fontSize: 13, color: "#6b7280", margin: "8px 0 0" }}>
          {scan.pieces.length}개 작품이 감지되었습니다. 분석할 작품을 선택하세요.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {scan.pieces.map((piece) => (
          <button
            key={piece.index}
            type="button"
            onClick={() => onPick(piece.index)}
            disabled={disabled}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 4,
              padding: "12px 16px",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              background: "#fff",
              cursor: disabled ? "not-allowed" : "pointer",
              textAlign: "left",
            }}
            onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.borderColor = "#3b82f6"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                {piece.index + 1}. {piece.title}
              </span>
              {piece.wordCount > 0 && (
                <span style={{ fontSize: 12, color: "#9ca3af" }}>
                  {piece.wordCount.toLocaleString()}단어
                </span>
              )}
            </div>
            {piece.preview && (
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
                {piece.preview.slice(0, 120)}...
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
