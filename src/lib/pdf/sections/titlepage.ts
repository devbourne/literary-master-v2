import type { TeachingMaterial } from "../../schemas/teaching-material";
import { escapeHtml } from "../escape";

export function renderTitlePage(m: TeachingMaterial): string {
  const date = new Date(m.metadata.generated_at).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
  });
  return `<div class="titlepage">
  <div class="part-label">Bilingual Annotated Edition</div>
  <h1>${escapeHtml(m.metadata.title)}</h1>
  <div class="author">${escapeHtml(m.metadata.author)}</div>
  <div class="fleuron"></div>
  <div class="imprint">
    <div>이중언어 정밀 해설</div>
    <div>Literary Master · ${escapeHtml(date)}</div>
  </div>
</div>`;
}
