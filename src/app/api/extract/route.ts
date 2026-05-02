export async function POST(req: Request) {
  const { text, pieceIndex, pieces } = (await req.json()) as {
    text: string;
    pieceIndex: number;
    pieces: Array<{ title: string; start_marker: string }>;
  };

  if (!text || pieceIndex < 0 || !pieces?.length) {
    return Response.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const piece = pieces[pieceIndex];
  const nextPiece = pieces[pieceIndex + 1];

  // Find start position
  const startMarker = piece.start_marker?.slice(0, 60) || piece.title;
  let startPos = text.indexOf(startMarker);
  if (startPos < 0) startPos = 0;

  // Find end position
  let endPos = text.length;
  if (nextPiece) {
    const nextMarker = nextPiece.start_marker?.slice(0, 60) || nextPiece.title;
    const found = text.indexOf(nextMarker, startPos + 100);
    if (found > 0) endPos = found;
  }

  const extracted = text.slice(startPos, endPos).trim();

  return Response.json({
    title: piece.title,
    text: extracted,
    charCount: extracted.length,
    wordCount: extracted.split(/\s+/).length,
  });
}
