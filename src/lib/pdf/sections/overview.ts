import type { TeachingMaterial } from "../../schemas/teaching-material";
import type { WorkProfile } from "../../schemas/profile";
import type { Synthesis } from "../../schemas/synthesis";
import { escapeHtml } from "../escape";

export function renderOverview(m: TeachingMaterial): string {
  const p = m.profile;
  const s = m.synthesis;
  return `<div class="part">
  <div class="part-opener">
    <div class="part-label">Part Ⅰ</div>
    <h2>작품 개관</h2>
  </div>

  ${renderThesis(s)}
  ${renderOverviewEssay(s, p)}
  ${renderOverviewGrid(p)}
  ${renderTwistEpigraph(s, p)}
  ${renderCast(p)}
  ${renderPlotTimeline(p)}
  ${renderForeshadowing(p)}
  ${renderSymbolismCompact(p)}
  ${renderCulturalContext(p, s)}

  <div class="fleuron"></div>
</div>`;
}

function renderThesis(s?: Synthesis): string {
  if (!s?.thesis_ko) return "";
  return `<div class="pullquote">${escapeHtml(s.thesis_ko)}</div>`;
}

function renderOverviewEssay(s: Synthesis | undefined, p: WorkProfile): string {
  const prose = s?.overview_essay_ko || p.korean_brief.message_ko || p.tone_overall;
  if (!prose) return "";
  return `<p class="lead dropcap">${escapeHtml(prose)}</p>`;
}

function renderOverviewGrid(p: WorkProfile): string {
  const cells: { label: string; body: string }[] = [];
  if (p.themes.length) {
    cells.push({
      label: "Themes",
      body: p.themes.map(escapeHtml).join(" · "),
    });
  }
  if (p.tone_overall) {
    cells.push({ label: "Tone", body: escapeHtml(p.tone_overall) });
  }
  if (p.author_style.narration) {
    cells.push({
      label: "Narration",
      body:
        escapeHtml(p.author_style.narration) +
        (p.author_style.dialect_register
          ? ` · ${escapeHtml(p.author_style.dialect_register)}`
          : ""),
    });
  }
  if (p.meta.genre || p.meta.era) {
    cells.push({
      label: "Genre",
      body:
        [p.meta.genre, p.meta.era].filter(Boolean).map(escapeHtml).join(" · "),
    });
  }
  if (!cells.length) return "";
  return `<div class="overview-grid">
  ${cells
    .map(
      (c) => `<div class="overview-cell">
    <div class="overview-cell-label">${c.label}</div>
    <div class="overview-cell-body">${c.body}</div>
  </div>`,
    )
    .join("")}
</div>`;
}

function renderTwistEpigraph(s: Synthesis | undefined, p: WorkProfile): string {
  const what = s?.twist_reading.thesis_ko || p.twist.what;
  const irony = s?.twist_reading.irony_direction_ko || p.twist.irony_direction;
  if (!what && !irony) return "";
  return `<div class="epigraph">
    <div class="en">${escapeHtml(what)}</div>
    ${irony ? `<div class="ko">${escapeHtml(irony)}</div>` : ""}
    <div class="attr">Twist</div>
  </div>`;
}

function renderCast(p: WorkProfile): string {
  if (!p.characters.length) return "";
  return `<h3 class="subsection"><span class="num">§1</span>등장인물</h3>
<table class="book-table">
  <caption>Dramatis Personae</caption>
  <thead>
    <tr><th style="width:22%">인물</th><th style="width:14%">역할</th><th>아크</th></tr>
  </thead>
  <tbody>
    ${p.characters
      .map(
        (c) => `<tr>
      <td><strong>${escapeHtml(c.name)}</strong>${
        c.defining_traits.length
          ? `<br><span class="small-caps" style="font-size:8.2pt;color:#8b7355;">${c.defining_traits
              .slice(0, 3)
              .map(escapeHtml)
              .join(" · ")}</span>`
          : ""
      }</td>
      <td>${escapeHtml(c.role || "-")}</td>
      <td>${formatArc(c)}</td>
    </tr>`,
      )
      .join("")}
  </tbody>
</table>`;
}

function formatArc(c: WorkProfile["characters"][number]): string {
  const parts: string[] = [];
  if (c.arc_start) parts.push(`<em>시작</em> — ${escapeHtml(c.arc_start)}`);
  if (c.arc_middle) parts.push(`<em>중반</em> — ${escapeHtml(c.arc_middle)}`);
  if (c.arc_end) parts.push(`<em>결말</em> — ${escapeHtml(c.arc_end)}`);
  return parts.join("<br>") || "-";
}

function renderPlotTimeline(p: WorkProfile): string {
  if (!p.plotStructure.length) return "";
  return `<h3 class="subsection"><span class="num">§2</span>플롯 구조</h3>
<div class="plot-timeline">
  ${p.plotStructure
    .map(
      (st) => `<div class="plot-stage">
    <div class="plot-stage-label">${escapeHtml(st.stage)}</div>
    <div class="plot-stage-summary">${escapeHtml(st.summary)}</div>
    ${
      st.evidence_quote
        ? `<div class="plot-stage-evidence">"${escapeHtml(st.evidence_quote.slice(0, 140))}"</div>`
        : ""
    }
  </div>`,
    )
    .join("")}
</div>`;
}

function renderForeshadowing(p: WorkProfile): string {
  if (!p.foreshadowing.length) return "";
  return `<h3 class="subsection"><span class="num">§3</span>복선과 회수</h3>
${p.foreshadowing
  .map(
    (f) => `<div class="pair-box">
  <div>
    <div class="pair-label">Setup · 복선</div>
    <div>${escapeHtml(f.setup)}</div>
    ${f.setupLocation ? `<div style="margin-top:1mm;font-style:italic;color:#8b7355;font-size:9pt;">${escapeHtml(f.setupLocation)}</div>` : ""}
  </div>
  <div>
    <div class="pair-label">Resolution · 회수</div>
    <div>${escapeHtml(f.resolution || "-")}</div>
  </div>
  ${f.effect ? `<div class="pair-effect">${escapeHtml(f.effect)}</div>` : ""}
</div>`,
  )
  .join("")}`;
}

function renderSymbolismCompact(p: WorkProfile): string {
  if (!p.symbolism.length) return "";
  return `<h3 class="subsection"><span class="num">§4</span>상징</h3>
<div>
  ${p.symbolism
    .map(
      (s) => `<div class="symbol-row">
    <div><div class="symbol-name">${escapeHtml(s.symbol)}</div>${
      s.appearances.length
        ? `<div class="symbol-appearances">${s.appearances.slice(0, 2).map(escapeHtml).join(" · ")}</div>`
        : ""
    }</div>
    <div>${escapeHtml(s.meaning)}</div>
  </div>`,
    )
    .join("")}
</div>`;
}

function renderCulturalContext(
  p: WorkProfile,
  s: Synthesis | undefined,
): string {
  const hasProfile =
    p.cultural_context.era_background.length ||
    p.cultural_context.references.length;
  const hasSynthesisPaper = !!s?.cultural_notes_ko;
  if (!hasProfile && !hasSynthesisPaper) return "";
  return `<h3 class="subsection"><span class="num">§5</span>문화 · 역사 배경</h3>
${
  p.cultural_context.era_background.length
    ? `<ul style="margin: 0 0 4mm 5mm; font-size: 10pt; line-height:1.65;">${p.cultural_context.era_background.map((e) => `<li style="margin-bottom:1mm;">${escapeHtml(e)}</li>`).join("")}</ul>`
    : ""
}
${
  p.cultural_context.references.length
    ? `<table class="book-table">
    <thead><tr><th style="width:30%">용어</th><th>설명</th></tr></thead>
    <tbody>${p.cultural_context.references.map((r) => `<tr><td><strong>${escapeHtml(r.term)}</strong></td><td>${escapeHtml(r.explanation_ko)}</td></tr>`).join("")}</tbody>
  </table>`
    : ""
}
${hasSynthesisPaper ? `<p class="body" style="margin-top:4mm;">${escapeHtml(s!.cultural_notes_ko)}</p>` : ""}`;
}
