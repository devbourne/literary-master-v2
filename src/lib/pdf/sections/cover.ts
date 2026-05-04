import type { TeachingMaterial } from "../../schemas/teaching-material";
import { escapeHtml } from "../escape";

export function renderCover(m: TeachingMaterial): string {
  const date = new Date(m.metadata.generated_at).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const era = m.profile.meta.era ? escapeHtml(m.profile.meta.era) : "";
  const genre = m.profile.meta.genre
    ? escapeHtml(m.profile.meta.genre)
    : "Literary Work";
  const themeKo = m.profile.korean_brief?.theme_ko
    ? escapeHtml(m.profile.korean_brief.theme_ko)
    : "";
  const blockCount = m.blocks.length;
  return `<div class="cover">
  <div class="cover-bleed">
    <div class="cover-corner tl"></div>
    <div class="cover-corner tr"></div>
    <div class="cover-corner bl"></div>
    <div class="cover-corner br"></div>
    <div class="cover-header">
      <span class="cover-house">Literary Master</span>
      <span class="cover-house-meta">Bilingual · Annotated · Study</span>
    </div>
    <div class="cover-title-block">
      <div class="cover-label">영문 원작 정밀 해설</div>
      <div class="cover-fleuron-top">❦</div>
      <h1 class="cover-title">${escapeHtml(m.metadata.title)}</h1>
      <div class="cover-rule"></div>
      <div class="cover-author">${escapeHtml(m.metadata.author)}</div>
      ${
        themeKo
          ? `<div class="cover-motto">「 ${themeKo} 」</div>`
          : ""
      }
      <div class="cover-fleuron-bottom">❧ &nbsp; ❦ &nbsp; ❧</div>
      <div class="cover-edition">이중언어 정본 · 학습자용 주해본</div>
    </div>
    <div class="cover-footer">
      <div class="cover-imprint">
        <span class="cover-imprint-genre">${genre}</span>
        ${era ? `<span class="cover-imprint-sep">·</span><span class="cover-imprint-era">${era}</span>` : ""}
        <span class="cover-imprint-sep">·</span><span class="cover-imprint-blocks">${blockCount} 단락</span>
      </div>
      <div class="cover-date">${escapeHtml(date)}</div>
    </div>
  </div>
</div>`;
}
