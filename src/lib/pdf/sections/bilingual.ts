import type { TeachingMaterial } from "../../schemas/teaching-material";
import type { AnnotatedBlock, Annotation } from "../../schemas/block";
import { escapeHtml } from "../escape";

export function renderBilingual(m: TeachingMaterial): string {
  if (!m.blocks.length) return "";
  return `<div class="part">
  <div class="part-opener">
    <div class="part-label">Part Ⅱ</div>
    <h2>이중언어 정밀 읽기</h2>
  </div>
  <p class="bilingual-intro">
    원문과 번역을 나란히 배치했습니다. 핵심 어휘는 우측 여백의 메모로,
    문화·수사·복선 주해는 본문 아래의 학술 각주(脚註) 형식으로 실었습니다.
  </p>
  ${m.blocks.map((b, i) => renderPair(b, i)).join("")}
</div>`;
}

interface FootnoteEntry {
  marker: string;
  label: string;
  body: string;
}

function buildFootnotes(a: Annotation): FootnoteEntry[] {
  const out: FootnoteEntry[] = [];
  let n = 1;
  if (a.containsForeshadowing) {
    out.push({
      marker: String(n++),
      label: "복선",
      body: escapeHtml(a.foreshadowingSetupRef || "이 지점에 복선이 심어집니다."),
    });
  }
  if (a.containsCallback) {
    out.push({
      marker: String(n++),
      label: "회수",
      body: escapeHtml(a.callbackRef || "앞선 복선이 여기서 회수됩니다."),
    });
  }
  if (a.toneShift) {
    out.push({ marker: String(n++), label: "톤 전환", body: escapeHtml(a.toneShift) });
  }
  if (a.sceneTransition) {
    out.push({ marker: String(n++), label: "장면 전환", body: "장면이 전환됩니다." });
  }
  for (const s of a.symbolismPresent) {
    out.push({ marker: String(n++), label: "상징", body: escapeHtml(s) });
  }
  for (const d of a.literaryDevices) {
    out.push({
      marker: String(n++),
      label: "수사",
      body: `<b>${escapeHtml(d.device)}</b> &mdash; ${escapeHtml(d.description_ko)}`,
    });
  }
  for (const c of a.culturalReferences) {
    out.push({
      marker: String(n++),
      label: "문화",
      body: `<b>${escapeHtml(c.term)}</b> · ${escapeHtml(c.explanation_ko)}`,
    });
  }
  if (a.notable_quote) {
    out.push({
      marker: String(n++),
      label: "명문",
      body: `<span class="en">"${escapeHtml(a.notable_quote)}"</span>`,
    });
  }
  return out;
}

function renderMarginVocab(a: Annotation): string {
  if (!a.key_vocabulary.length) return "";
  const items = a.key_vocabulary
    .map((v) => {
      const pos = v.part_of_speech
        ? `<span class="mv-pos">${escapeHtml(v.part_of_speech)}</span>`
        : "";
      const ctx = v.context_note_ko
        ? ` <span class="mv-ctx">(${escapeHtml(v.context_note_ko)})</span>`
        : "";
      return `<li class="mv-item"><span class="mv-en">${escapeHtml(v.en)}</span>${pos}<span class="mv-ko">${escapeHtml(v.ko_gloss)}</span>${ctx}</li>`;
    })
    .join("");
  return `<aside class="bi-margin-vocab" aria-label="key vocabulary">
    <div class="mv-head">어휘<span class="mv-head-en">Vocab</span></div>
    <ul class="mv-list">${items}</ul>
  </aside>`;
}

function renderFootnotes(notes: FootnoteEntry[]): string {
  if (!notes.length) return "";
  return `<ol class="bi-footnotes">
    ${notes
      .map(
        (n) => `<li class="bi-fn">
        <span class="bi-fn-marker">${n.marker}</span>
        <span class="bi-fn-label">${escapeHtml(n.label)}</span>
        <span class="bi-fn-body">${n.body}</span>
      </li>`,
      )
      .join("")}
  </ol>`;
}

function renderPair(b: AnnotatedBlock, idx: number): string {
  const literary = b.revised_literary_translation || b.literary_translation;
  const literal = b.revised_literal_translation || b.literal_translation;
  const notes = buildFootnotes(b.annotations);
  return `<div class="bi-pair">
  ${renderMarginVocab(b.annotations)}
  <div class="bi-pair-marker">§${idx + 1}${b.blockId ? ` · ${escapeHtml(b.blockId)}` : ""}</div>
  <div class="bi-row">
    <div class="bi-en">${escapeHtml(b.originalText)}</div>
    <div class="bi-ko">
      <div>${escapeHtml(literary)}</div>
      ${
        literal && literal !== literary
          ? `<div class="bi-ko-literal"><span class="bi-ko-literal-label">직역</span>${escapeHtml(literal)}</div>`
          : ""
      }
    </div>
  </div>
  ${b.korean_commentary ? `<div class="bi-commentary">${escapeHtml(b.korean_commentary)}</div>` : ""}
  ${renderFootnotes(notes)}
</div>`;
}
