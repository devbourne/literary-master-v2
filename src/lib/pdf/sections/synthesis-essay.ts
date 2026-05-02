import type { TeachingMaterial } from "../../schemas/teaching-material";
import type {
  Synthesis,
  AnnotatedQuote,
  CharacterReading,
  SymbolReading,
} from "../../schemas/synthesis";
import { escapeHtml } from "../escape";

export function renderSynthesis(m: TeachingMaterial): string {
  const s = m.synthesis;
  const legacyMd = m.synthesis_markdown;

  if (!s && !legacyMd) return "";

  return `<div class="part">
  <div class="part-opener">
    <div class="part-label">Part Ⅲ</div>
    <h2>종합 분석</h2>
  </div>

  ${s ? renderStructured(s) : renderLegacyMd(legacyMd)}

  <div class="fleuron"></div>
</div>`;
}

function renderStructured(s: Synthesis): string {
  return `
  ${s.thesis_ko ? `<div class="pullquote">${escapeHtml(s.thesis_ko)}</div>` : ""}
  ${renderProseSection("§1", "작품 개요", s.overview_essay_ko, true)}
  ${renderCharacterReadings(s.character_readings)}
  ${renderProseSection("§3", "플롯 해석", s.plot_reading_ko)}
  ${renderTwistReading(s)}
  ${renderSymbolismReadings(s.symbolism_readings)}
  ${renderProseSection("§6", "톤 흐름", s.tone_flow_ko)}
  ${renderProseSection("§7", "문체", s.style_essay_ko)}
  ${renderReadingGuide(s.reading_guide_ko)}
  ${s.closing_note_ko ? `<div class="synthesis-section"><p class="body">${escapeHtml(s.closing_note_ko)}</p></div>` : ""}
`;
}

function renderProseSection(
  num: string,
  title: string,
  body: string,
  drop?: boolean,
): string {
  if (!body) return "";
  return `<div class="synthesis-section">
    <h3 class="subsection"><span class="num">${num}</span>${escapeHtml(title)}</h3>
    <p class="body synthesis-prose${drop ? " dropcap" : ""}">${escapeHtml(body)}</p>
  </div>`;
}

function renderCharacterReadings(rs: CharacterReading[]): string {
  if (!rs.length) return "";
  const body = rs
    .map((r) => {
      if (!r.reading_ko && !r.name) return "";
      return `<h4 class="minor">${escapeHtml(r.name)}</h4>
      <p class="body synthesis-prose">${escapeHtml(r.reading_ko)}</p>
      ${r.key_quote ? renderQuote(r.key_quote) : ""}`;
    })
    .filter(Boolean)
    .join("");
  if (!body) return "";
  return `<div class="synthesis-section">
    <h3 class="subsection"><span class="num">§2</span>인물 해석</h3>
    ${body}
  </div>`;
}

function renderTwistReading(s: Synthesis): string {
  const t = s.twist_reading;
  const hasContent =
    t.thesis_ko ||
    t.irony_direction_ko ||
    t.comparison_ko ||
    t.setup_moments.length ||
    t.payoff_moments.length;
  if (!hasContent) return "";

  return `<div class="synthesis-section">
    <h3 class="subsection"><span class="num">§4</span>반전과 아이러니</h3>
    ${t.thesis_ko ? `<p class="body synthesis-prose"><strong>논지.</strong> ${escapeHtml(t.thesis_ko)}</p>` : ""}
    ${t.irony_direction_ko ? `<p class="body synthesis-prose"><strong>아이러니의 방향.</strong> ${escapeHtml(t.irony_direction_ko)}</p>` : ""}
    ${t.comparison_ko ? `<p class="body synthesis-prose"><strong>비교 구조.</strong> ${escapeHtml(t.comparison_ko)}</p>` : ""}
    ${
      t.setup_moments.length
        ? `<h4 class="minor">복선 (Setup)</h4>${t.setup_moments.map(renderQuote).join("")}`
        : ""
    }
    ${
      t.payoff_moments.length
        ? `<h4 class="minor">회수 (Payoff)</h4>${t.payoff_moments.map(renderQuote).join("")}`
        : ""
    }
  </div>`;
}

function renderSymbolismReadings(rs: SymbolReading[]): string {
  if (!rs.length) return "";
  const body = rs
    .map((r) => {
      if (!r.reading_ko && !r.symbol) return "";
      return `<h4 class="minor">${escapeHtml(r.symbol)}</h4>
      <p class="body synthesis-prose">${escapeHtml(r.reading_ko)}</p>
      ${r.evidence ? `<div class="synthesis-quote"><div class="en">"${escapeHtml(r.evidence.en)}"</div><div class="ko">${escapeHtml(r.evidence.ko)}</div></div>` : ""}`;
    })
    .filter(Boolean)
    .join("");
  if (!body) return "";
  return `<div class="synthesis-section">
    <h3 class="subsection"><span class="num">§5</span>상징 심화</h3>
    ${body}
  </div>`;
}

function renderReadingGuide(guide: string[]): string {
  if (!guide.length) return "";
  return `<div class="synthesis-section">
    <h3 class="subsection"><span class="num">§8</span>한국 독자를 위한 읽기 가이드</h3>
    <ol class="reading-guide">
      ${guide.map((g) => `<li>${escapeHtml(g)}</li>`).join("")}
    </ol>
  </div>`;
}

function renderQuote(q: AnnotatedQuote): string {
  return `<div class="synthesis-quote">
    <div class="en">"${escapeHtml(q.en)}"</div>
    <div class="ko">${escapeHtml(q.ko)}</div>
    ${q.note_ko ? `<div class="note">${escapeHtml(q.note_ko)}</div>` : ""}
  </div>`;
}

function renderLegacyMd(md: string): string {
  // Legacy: conservative MD → HTML conversion for saved pre-v2 materials.
  const html = mdToHtml(md);
  return `<div class="synthesis-prose">${html}</div>`;
}

function mdToHtml(md: string): string {
  let html = escapeHtml(md);
  html = html.replace(/^### (.*?)$/gm, "<h4 class='minor'>$1</h4>");
  html = html.replace(/^## (.*?)$/gm, "<h3 class='subsection'>$1</h3>");
  html = html.replace(/^# (.*?)$/gm, "<h2>$1</h2>");
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^\*]+)\*/g, "<em>$1</em>");
  html = html.replace(/^&gt; (.*?)$/gm, "<blockquote>$1</blockquote>");
  html = html.replace(/^(- |\* )(.+)$/gm, "<li>$2</li>");
  html = html.replace(/(<li>.*?<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
  html = html
    .split(/\n{2,}/)
    .map((pp) => (pp.startsWith("<") ? pp : `<p class="body">${pp.replace(/\n/g, "<br>")}</p>`))
    .join("\n");
  return html;
}
