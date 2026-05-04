// PDF Part Ⅳ — 다관점 통합 (v2.5 multi-perspective enrichment).
// Renders the 4 fields produced by Synthesis Stage 4b as a culminating
// publication-grade chapter:
//   §1 통합 에세이      — multi_perspective_synthesis_ko (lead essay)
//   §2 관점 간 보완      — complementary_insights[] (angle pair callouts)
//   §3 미해결 긴장       — unresolved_tensions[] (numbered with verdicts)
//   §4 한국 독자 학습    — pedagogical_scaffolding (cultural / parallel / questions)

import type { TeachingMaterial } from "../../schemas/teaching-material";
import type {
  ComplementaryInsight,
  UnresolvedTension,
  PedagogicalScaffolding,
} from "../../schemas/synthesis";
import { escapeHtml } from "../escape";

export function renderMultiPerspective(m: TeachingMaterial): string {
  const s = m.synthesis;
  if (!s) return "";

  const meta = s.multi_perspective_synthesis_ko ?? "";
  const insights: ComplementaryInsight[] = s.complementary_insights ?? [];
  const tensions: UnresolvedTension[] = s.unresolved_tensions ?? [];
  const ped: PedagogicalScaffolding | undefined = s.pedagogical_scaffolding;
  const pedHasContent =
    ped &&
    (ped.cultural_pitfalls_ko ||
      ped.korean_literature_parallels_ko ||
      ped.discussion_questions_ko.length > 0);

  // No multi-perspective content → don't render the part at all.
  if (!meta && !insights.length && !tensions.length && !pedHasContent) {
    return "";
  }

  return `<div class="part">
  <div class="part-opener">
    <div class="part-label">Part Ⅳ</div>
    <h2>다관점 통합</h2>
  </div>

  ${renderMetaEssay(meta)}
  ${renderComplementaryInsights(insights)}
  ${renderUnresolvedTensions(tensions)}
  ${pedHasContent ? renderPedagogical(ped!) : ""}

  <div class="fleuron"></div>
</div>`;
}

function renderMetaEssay(meta: string): string {
  if (!meta) return "";
  return `<div class="synthesis-section mp-meta">
    <h3 class="subsection"><span class="num">§1</span>통합 에세이</h3>
    <p class="body synthesis-prose dropcap">${escapeHtml(meta)}</p>
  </div>`;
}

function renderComplementaryInsights(insights: ComplementaryInsight[]): string {
  if (!insights.length) return "";
  const items = insights
    .filter((ci) => ci.angle_pair || ci.insight_ko)
    .map(
      (ci) => `<div class="mp-insight">
        ${ci.angle_pair ? `<div class="mp-anglepair">${escapeHtml(ci.angle_pair)}</div>` : ""}
        <p class="body synthesis-prose">${escapeHtml(ci.insight_ko)}</p>
      </div>`,
    )
    .join("");
  if (!items) return "";
  return `<div class="synthesis-section">
    <h3 class="subsection"><span class="num">§2</span>관점 간 보완</h3>
    <p class="body synthesis-prose mp-lead">서로 다른 비평 각도가 같은 텍스트의 다른 층위를 비추는 지점들. 각 항목은 두 관점이 어떻게 서로를 보완하는지 명시한다.</p>
    <div class="mp-insight-list">
      ${items}
    </div>
  </div>`;
}

function renderUnresolvedTensions(tensions: UnresolvedTension[]): string {
  if (!tensions.length) return "";
  const items = tensions
    .filter((t) => t.description_ko || t.most_defensible_ko)
    .map(
      (t, i) => `<li class="mp-tension">
        <div class="mp-tension-no">${i + 1}</div>
        <div class="mp-tension-body">
          <p class="body synthesis-prose">${escapeHtml(t.description_ko)}</p>
          ${
            t.most_defensible_ko
              ? `<p class="body synthesis-prose mp-verdict"><span class="mp-verdict-label">판정</span> ${escapeHtml(t.most_defensible_ko)}</p>`
              : ""
          }
        </div>
      </li>`,
    )
    .join("");
  if (!items) return "";
  return `<div class="synthesis-section">
    <h3 class="subsection"><span class="num">§3</span>미해결 긴장</h3>
    <p class="body synthesis-prose mp-lead">두 비평 관점이 양립하기 어려운 지점들. 각 긴장에 대해 본문에 더 잘 부합하는 해석을 명시한다.</p>
    <ol class="mp-tension-list">
      ${items}
    </ol>
  </div>`;
}

function renderPedagogical(ped: PedagogicalScaffolding): string {
  const parts: string[] = [];
  if (ped.cultural_pitfalls_ko) {
    parts.push(`<h4 class="minor">문화적 함정</h4>
      <p class="body synthesis-prose">${escapeHtml(ped.cultural_pitfalls_ko)}</p>`);
  }
  if (ped.korean_literature_parallels_ko) {
    parts.push(`<h4 class="minor">한국 문학과의 비교</h4>
      <p class="body synthesis-prose">${escapeHtml(ped.korean_literature_parallels_ko)}</p>`);
  }
  if (ped.discussion_questions_ko.length) {
    parts.push(`<h4 class="minor">토론 질문</h4>
      <ol class="reading-guide mp-discussion">
        ${ped.discussion_questions_ko.map((q) => `<li>${escapeHtml(q)}</li>`).join("")}
      </ol>`);
  }
  if (!parts.length) return "";
  return `<div class="synthesis-section">
    <h3 class="subsection"><span class="num">§4</span>한국 독자 학습 자료</h3>
    ${parts.join("")}
  </div>`;
}
