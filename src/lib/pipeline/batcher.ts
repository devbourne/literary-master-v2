import type { AnnotatedBlock } from "../schemas/block";
import type { WorkProfile } from "../schemas/profile";

export function chunkBlocks<T>(arr: T[], size = 5): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function truncate(s: string, max = 800): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 3) + "...";
}

export function summarizeProfileForBatch(profile: WorkProfile): string {
  const summary = {
    title: profile.title,
    themes: profile.themes,
    characters: profile.characters.map((c) => ({ name: c.name, role: c.role })),
    symbolism: profile.symbolism.map((s) => ({ symbol: s.symbol, meaning: s.meaning })),
    foreshadowing: profile.foreshadowing.map((f) => ({
      setup: f.setup.slice(0, 80),
      resolution: f.resolution.slice(0, 80),
    })),
    twist: profile.twist,
    tone_overall: profile.tone_overall,
  };
  return truncate(JSON.stringify(summary, null, 2), 1500);
}

export function formatPreviousTranslations(
  blocks: AnnotatedBlock[],
  n = 2,
): string {
  const slice = blocks.slice(-n);
  return slice
    .map(
      (b) =>
        `[${b.blockId}] ${b.revised_literary_translation || b.literary_translation}`,
    )
    .join("\n\n");
}
