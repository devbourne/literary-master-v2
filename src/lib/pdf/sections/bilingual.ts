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
    원문과 번역을 나란히 배치했습니다. 각 단락 아래에는 해석 노트와
    어휘 · 수사 · 문화 주해를 작은 행간(行間) 각주 형식으로 실었습니다.
  </p>
  ${m.blocks.map((b, i) => renderPair(b, i)).join("")}
</div>`;
}

function renderPair(b: AnnotatedBlock, idx: number): string {
  const literary = b.revised_literary_translation || b.literary_translation;
  const literal = b.revised_literal_translation || b.literal_translation;
  return `<div class="bi-pair">
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
  ${renderNotes(b.annotations)}
</div>`;
}

function renderNotes(a: Annotation): string {
  const notes: { label: string; body: string }[] = [];

  if (a.containsForeshadowing) {
    notes.push({
      label: "복선",
      body: escapeHtml(a.foreshadowingSetupRef || "이 지점에 복선이 심어집니다."),
    });
  }
  if (a.containsCallback) {
    notes.push({
      label: "회수",
      body: escapeHtml(a.callbackRef || "앞선 복선이 여기서 회수됩니다."),
    });
  }
  if (a.toneShift) {
    notes.push({ label: "톤 전환", body: escapeHtml(a.toneShift) });
  }
  if (a.sceneTransition) {
    notes.push({ label: "장면 전환", body: "장면이 전환됩니다." });
  }
  for (const s of a.symbolismPresent) {
    notes.push({ label: "상징", body: escapeHtml(s) });
  }
  for (const d of a.literaryDevices) {
    notes.push({
      label: "수사",
      body: `<b>${escapeHtml(d.device)}</b> — ${escapeHtml(d.description_ko)}`,
    });
  }
  for (const c of a.culturalReferences) {
    notes.push({
      label: "문화",
      body: `<b>${escapeHtml(c.term)}</b> · ${escapeHtml(c.explanation_ko)}`,
    });
  }
  if (a.notable_quote) {
    notes.push({
      label: "명문",
      body: `<span class="en">"${escapeHtml(a.notable_quote)}"</span>`,
    });
  }
  for (const v of a.key_vocabulary) {
    const pos = v.part_of_speech
      ? ` <i style="color:#8b7355;">${escapeHtml(v.part_of_speech)}</i>`
      : "";
    const ctx = v.context_note_ko
      ? ` <span style="color:#5c4f3f;font-style:italic;">(${escapeHtml(v.context_note_ko)})</span>`
      : "";
    notes.push({
      label: "어휘",
      body: `<b>${escapeHtml(v.en)}</b>${pos} · ${escapeHtml(v.ko_gloss)}${ctx}`,
    });
  }

  if (!notes.length) return "";
  return `<div class="bi-notes">
  ${notes
    .map(
      (n) => `<div class="bi-note">
    <div class="bi-note-label">${n.label}</div>
    <div class="bi-note-body">${n.body}</div>
  </div>`,
    )
    .join("")}
</div>`;
}
