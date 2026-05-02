import type { TeachingMaterial } from "../../schemas/teaching-material";
import { escapeHtml } from "../escape";

export function renderCover(m: TeachingMaterial): string {
  const date = new Date(m.metadata.generated_at).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const era = m.profile.meta.era ? `· ${escapeHtml(m.profile.meta.era)}` : "";
  const genre = m.profile.meta.genre ? escapeHtml(m.profile.meta.genre) : "Literary Work";
  return `<div class="cover">
  <div class="cover-header">
    <span>Literary Master</span>
    <span>Bilingual · Annotated</span>
  </div>
  <div class="cover-title-block">
    <div class="cover-label">영문 원작 정밀 해설 · Study Edition</div>
    <h1 class="cover-title">${escapeHtml(m.metadata.title)}</h1>
    <div class="cover-subtitle">이중언어 · 주해본 · 학습자용</div>
    <div class="cover-rule"></div>
    <div class="cover-author">${escapeHtml(m.metadata.author)}</div>
  </div>
  <div class="cover-footer">
    <div class="cover-imprint">${genre} ${era}</div>
    <div>${escapeHtml(date)}</div>
  </div>
</div>`;
}
