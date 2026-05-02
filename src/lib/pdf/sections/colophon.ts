import type { TeachingMaterial } from "../../schemas/teaching-material";
import { escapeHtml } from "../escape";

export function renderColophon(m: TeachingMaterial): string {
  const date = new Date(m.metadata.generated_at).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<div class="colophon">
  <div class="title-small">${escapeHtml(m.metadata.title)}</div>
  <div class="fleuron"></div>
  <div class="meta">Literary Master</div>
  <div class="meta">Bilingual Annotated Edition</div>
  <div class="meta">${escapeHtml(date)}</div>
</div>`;
}
