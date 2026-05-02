// v2 Phase D — server-side piece extraction.
//
// Replaces the client's local indexOf-based matching. Client posts:
//   { text, pieceIndex, pieces: [{ title, start_quote? }] }
// Server runs the segmentation agent (quote → regex → title → fuzzy fallback)
// and returns the extracted slice plus diagnostics so the client can show
// which strategy actually resolved the boundary.

import { runSegmentationAgent } from "@/lib/agents/segmentation-agent";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 JSON" }, { status: 400 });
  }

  const { text, pieceIndex, pieces } =
    (body as {
      text?: unknown;
      pieceIndex?: unknown;
      pieces?: unknown;
    }) ?? {};

  if (typeof text !== "string" || text.length === 0) {
    return Response.json({ error: "텍스트가 필요합니다." }, { status: 400 });
  }
  if (typeof pieceIndex !== "number" || pieceIndex < 0) {
    return Response.json({ error: "pieceIndex가 잘못되었습니다." }, { status: 400 });
  }
  if (!Array.isArray(pieces) || pieces.length === 0) {
    return Response.json({ error: "pieces 배열이 필요합니다." }, { status: 400 });
  }

  // Accept v2 ({title, start_quote}), legacy ({title, start_marker}), and
  // bare-title-string shapes so existing clients keep working during rollout.
  const normalizedPieces = pieces.map((p) => {
    if (typeof p === "string") return { title: p };
    const obj = p as { title?: string; start_quote?: string; start_marker?: string };
    return {
      title: obj.title ?? "",
      start_quote: obj.start_quote ?? obj.start_marker,
    };
  });

  if (pieceIndex >= normalizedPieces.length) {
    return Response.json({ error: "pieceIndex 범위 초과" }, { status: 400 });
  }

  try {
    const result = runSegmentationAgent({
      fullText: text,
      pieces: normalizedPieces,
      pieceIndex,
    });
    return Response.json(result);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "extract 실패" },
      { status: 500 },
    );
  }
}
