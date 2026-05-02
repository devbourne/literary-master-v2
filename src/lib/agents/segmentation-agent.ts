// v2 Phase D — Segmentation Agent.
//
// Resolves a single piece's text boundaries within a multi-piece source by
// trying a chain of fallback strategies. The new scan API returns each piece's
// `start_quote` (first ~50 chars of body content); the agent finds where that
// quote lives in the full text and (for non-final pieces) where the next
// piece's quote begins. Strategies, in order:
//
//   1. exact: indexOf(start_quote)
//   2. regex: case-insensitive + flexible whitespace match for the start_quote
//   3. title: indexOf(title) — falls back to the legacy v1 behavior
//   4. fuzzy: walks first 10 words of the start_quote and finds the position
//      of the longest matching prefix (handles minor punctuation/typo drift)
//
// Returns the extracted slice plus a diagnostic record of which strategy won.

export interface SegmentationPiece {
  title: string;
  /** First ~50 chars of body content (after title), supplied by scan agent. */
  start_quote?: string;
}

export interface SegmentationInput {
  fullText: string;
  pieces: SegmentationPiece[];
  pieceIndex: number;
}

export type SegmentationStrategy =
  | "exact_quote"
  | "regex_quote"
  | "title"
  | "fuzzy_quote"
  | "fallback_zero";

export interface SegmentationResult {
  title: string;
  text: string;
  charCount: number;
  wordCount: number;
  startStrategy: SegmentationStrategy;
  endStrategy?: SegmentationStrategy;
  startPos: number;
  endPos: number;
  /** True if NEITHER start nor end could be resolved by an agent strategy. */
  fellBackToFullText: boolean;
}

const MIN_OFFSET_BETWEEN_PIECES = 100;

function normalizeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
}

function findExact(text: string, needle: string, fromIndex = 0): number {
  if (!needle) return -1;
  return text.indexOf(needle, fromIndex);
}

function findRegex(text: string, needle: string, fromIndex = 0): number {
  if (!needle || needle.length < 6) return -1;
  try {
    const re = new RegExp(normalizeForRegex(needle), "i");
    re.lastIndex = fromIndex;
    const m = text.slice(fromIndex).match(re);
    if (!m || m.index === undefined) return -1;
    return fromIndex + m.index;
  } catch {
    return -1;
  }
}

function findFuzzy(text: string, needle: string, fromIndex = 0): number {
  // Walk the first ~10 whitespace-separated tokens of the needle, drop one
  // from the end on each miss, and try indexOf. Returns the position of the
  // longest matching prefix, or -1.
  const tokens = needle.split(/\s+/).filter(Boolean).slice(0, 10);
  for (let len = tokens.length; len >= 3; len--) {
    const probe = tokens.slice(0, len).join(" ");
    const pos = text.indexOf(probe, fromIndex);
    if (pos >= 0) return pos;
  }
  return -1;
}

function locate(
  text: string,
  piece: SegmentationPiece,
  fromIndex: number,
): { pos: number; strategy: SegmentationStrategy } | null {
  const quote = (piece.start_quote || "").trim();
  if (quote.length >= 6) {
    const exact = findExact(text, quote, fromIndex);
    if (exact >= 0) return { pos: exact, strategy: "exact_quote" };
    const rx = findRegex(text, quote, fromIndex);
    if (rx >= 0) return { pos: rx, strategy: "regex_quote" };
  }
  if (piece.title?.trim()) {
    // Title strategy mimics the v1 client matching: find SECOND occurrence so
    // table-of-contents entries don't claim the boundary. Falls back to the
    // first occurrence if there's only one.
    const first = findExact(text, piece.title, fromIndex);
    const second =
      first >= 0
        ? findExact(text, piece.title, first + piece.title.length + 5)
        : -1;
    if (second >= 0) return { pos: second, strategy: "title" };
    if (first >= 0) return { pos: first, strategy: "title" };
  }
  if (quote.length >= 6) {
    const fuzzy = findFuzzy(text, quote, fromIndex);
    if (fuzzy >= 0) return { pos: fuzzy, strategy: "fuzzy_quote" };
  }
  return null;
}

export function runSegmentationAgent(
  input: SegmentationInput,
): SegmentationResult {
  const { fullText, pieces, pieceIndex } = input;
  const piece = pieces[pieceIndex];
  if (!piece) {
    throw new Error(`segmentation: pieceIndex ${pieceIndex} out of range`);
  }

  const startResolved = locate(fullText, piece, 0);
  const startPos = startResolved?.pos ?? 0;
  const startStrategy = startResolved?.strategy ?? "fallback_zero";

  let endPos = fullText.length;
  let endStrategy: SegmentationStrategy | undefined;
  const next = pieces[pieceIndex + 1];
  if (next) {
    const nextResolved = locate(
      fullText,
      next,
      startPos + MIN_OFFSET_BETWEEN_PIECES,
    );
    if (nextResolved) {
      endPos = nextResolved.pos;
      endStrategy = nextResolved.strategy;
    }
  }

  const text = fullText.slice(startPos, endPos).trim();
  return {
    title: piece.title,
    text,
    charCount: text.length,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    startStrategy,
    endStrategy,
    startPos,
    endPos,
    fellBackToFullText:
      startStrategy === "fallback_zero" && endStrategy === undefined,
  };
}
