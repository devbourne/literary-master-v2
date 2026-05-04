import type { TeachingMaterial } from "../../schemas/teaching-material";
import { escapeHtml } from "../escape";
import { computePartLabels } from "./part-labels";

interface IndexEntry {
  term: string;
  ko?: string;
  pointer: string;
}

function blockPointer(blockIdx: number, blockId?: string): string {
  return `§${blockIdx + 1}${blockId ? `·${blockId}` : ""}`;
}

function dedupeMerge(entries: IndexEntry[]): IndexEntry[] {
  const map = new Map<string, IndexEntry>();
  for (const e of entries) {
    const key = e.term.toLowerCase().trim();
    if (!key) continue;
    const existing = map.get(key);
    if (existing) {
      const ptrs = new Set(existing.pointer.split(", ").filter(Boolean));
      ptrs.add(e.pointer);
      existing.pointer = Array.from(ptrs).join(", ");
      if (!existing.ko && e.ko) existing.ko = e.ko;
    } else {
      map.set(key, { ...e });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.term.localeCompare(b.term, "en", { sensitivity: "base" }),
  );
}

function characters(m: TeachingMaterial): IndexEntry[] {
  return m.profile.characters.map((c) => ({
    term: c.name,
    ko: c.role || c.defining_traits.slice(0, 2).join(" · "),
    pointer: "프로필",
  }));
}

function symbols(m: TeachingMaterial): IndexEntry[] {
  const out: IndexEntry[] = [];
  for (const s of m.profile.symbolism) {
    if (!s.symbol) continue;
    out.push({ term: s.symbol, ko: s.meaning, pointer: "프로필" });
  }
  m.blocks.forEach((b, i) => {
    for (const sym of b.annotations.symbolismPresent) {
      if (!sym) continue;
      out.push({ term: sym, pointer: blockPointer(i, b.blockId) });
    }
  });
  return out;
}

function culturalRefs(m: TeachingMaterial): IndexEntry[] {
  const out: IndexEntry[] = [];
  for (const c of m.profile.cultural_context.references) {
    if (!c.term) continue;
    out.push({ term: c.term, ko: c.explanation_ko, pointer: "프로필" });
  }
  m.blocks.forEach((b, i) => {
    for (const c of b.annotations.culturalReferences) {
      if (!c.term) continue;
      out.push({
        term: c.term,
        ko: c.explanation_ko,
        pointer: blockPointer(i, b.blockId),
      });
    }
  });
  return out;
}

function vocabulary(m: TeachingMaterial): IndexEntry[] {
  const out: IndexEntry[] = [];
  m.blocks.forEach((b, i) => {
    for (const v of b.annotations.key_vocabulary) {
      if (!v.en) continue;
      out.push({
        term: v.en,
        ko: v.ko_gloss,
        pointer: blockPointer(i, b.blockId),
      });
    }
  });
  return out;
}

function renderColumn(
  title: string,
  subtitle: string,
  entries: IndexEntry[],
): string {
  if (!entries.length) return "";
  return `<section class="idx-column">
    <h3 class="idx-col-title">
      <span class="idx-col-title-ko">${escapeHtml(title)}</span>
      <span class="idx-col-title-en">${escapeHtml(subtitle)}</span>
      <span class="idx-col-count">${entries.length}</span>
    </h3>
    <ul class="idx-list">
      ${entries
        .map(
          (e) => `<li class="idx-entry">
        <span class="idx-term">${escapeHtml(e.term)}</span>
        ${e.ko ? `<span class="idx-ko">${escapeHtml(e.ko)}</span>` : ""}
        <span class="idx-pointer">${escapeHtml(e.pointer)}</span>
      </li>`,
        )
        .join("")}
    </ul>
  </section>`;
}

export function renderBackIndex(m: TeachingMaterial): string {
  const ch = dedupeMerge(characters(m));
  const sy = dedupeMerge(symbols(m));
  const cr = dedupeMerge(culturalRefs(m));
  const vo = dedupeMerge(vocabulary(m));
  const total = ch.length + sy.length + cr.length + vo.length;
  if (!total) return "";

  const labels = computePartLabels(m);
  return `<div class="part part-index">
  <div class="part-opener">
    <div class="part-label">Part ${labels.index ?? "—"}</div>
    <h2>색인 <span class="part-h2-en">Index</span></h2>
    <p class="part-opener-sub">
      본 교재 전반에 등장한 인물 · 상징 · 문화 · 어휘를 알파벳/가나다 순으로
      정리했습니다. 우측 표지(§N)는 원문 단락 번호이며, "프로필"은 작품
      개관(Part Ⅰ)에서 정의된 항목임을 뜻합니다.
    </p>
  </div>
  <div class="idx-grid">
    ${renderColumn("인물", "Characters", ch)}
    ${renderColumn("상징", "Symbols", sy)}
    ${renderColumn("문화 참조", "Cultural References", cr)}
    ${renderColumn("어휘", "Vocabulary", vo)}
  </div>
</div>`;
}
