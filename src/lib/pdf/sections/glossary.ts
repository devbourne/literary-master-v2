import type { TeachingMaterial } from "../../schemas/teaching-material";
import { escapeHtml } from "../escape";
import { computePartLabels } from "./part-labels";

interface VocabEntry {
  en: string;
  pos: string;
  ko: string;
  context: string;
}

export function renderGlossary(m: TeachingMaterial): string {
  const map = new Map<string, VocabEntry>();
  for (const b of m.blocks) {
    for (const v of b.annotations.key_vocabulary) {
      const key = v.en.toLowerCase().trim();
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, {
          en: v.en,
          pos: v.part_of_speech,
          ko: v.ko_gloss,
          context: v.context_note_ko,
        });
      }
    }
  }
  if (!map.size) return "";
  const items = Array.from(map.values()).sort((a, b) =>
    a.en.localeCompare(b.en, "en", { sensitivity: "base" }),
  );

  const labels = computePartLabels(m);
  return `<div class="part">
  <div class="part-opener">
    <div class="part-label">Part ${labels.glossary}</div>
    <h2>어휘 총람</h2>
  </div>
  <p class="glossary-intro">
    본문에서 등장한 핵심 어휘 ${items.length}개를 알파벳 순으로 정리했습니다.
    각 항목은 품사·기본 역어·문맥 주석으로 구성됩니다.
  </p>
  <div class="glossary">
    ${items
      .map(
        (v) => `<div class="vocab-item">
      <span class="vocab-term">${escapeHtml(v.en)}</span>${
        v.pos ? `<span class="vocab-pos">${escapeHtml(v.pos)}</span>` : ""
      }
      <span class="vocab-gloss">${escapeHtml(v.ko)}</span>
      ${v.context ? `<span class="vocab-context">${escapeHtml(v.context)}</span>` : ""}
    </div>`,
      )
      .join("")}
  </div>
</div>`;
}
