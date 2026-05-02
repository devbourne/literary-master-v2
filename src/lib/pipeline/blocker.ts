export interface Block {
  blockId: string;
  text: string;
}

export function splitIntoBlocks(text: string, minChars = 40): Block[] {
  // Try double-newline first (markdown paragraphs)
  let raw = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // If only 1-2 blocks found in long text, fall back to single newline split
  if (raw.length < 3 && text.length > 500) {
    raw = text
      .split(/\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  // If still too few blocks, fall back to sentence-level split (target ~200 chars per block)
  if (raw.length < 5 && text.length > 2000) {
    raw = chunkBySentences(text, 300);
  }

  // Merge tiny fragments (< minChars) into previous block
  const merged: string[] = [];
  for (const p of raw) {
    if (p.length < minChars && merged.length > 0) {
      merged[merged.length - 1] += " " + p;
    } else {
      merged.push(p);
    }
  }

  // Cap block size: if a block > 1500 chars, split further at sentence boundary
  const capped: string[] = [];
  for (const b of merged) {
    if (b.length > 1500) {
      capped.push(...chunkBySentences(b, 800));
    } else {
      capped.push(b);
    }
  }

  return capped.map((t, i) => ({
    blockId: `block_${String(i + 1).padStart(3, "0")}`,
    text: t,
  }));
}

function chunkBySentences(text: string, targetSize: number): string[] {
  // Match sentences ending with . ! ? " ' — may not be perfect but good enough
  const sentences = text.match(/[^.!?]+[.!?]+(?:["')\]]*)/g) || [text];
  const chunks: string[] = [];
  let current = "";

  for (const s of sentences) {
    const sentence = s.trim();
    if (!sentence) continue;
    if (current.length + sentence.length + 1 > targetSize && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? current + " " + sentence : sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks;
}
