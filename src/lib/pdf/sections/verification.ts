import type { TeachingMaterial } from "../../schemas/teaching-material";
import { escapeHtml } from "../escape";

export function renderVerification(m: TeachingMaterial): string {
  if (m.verification.verified) return "";
  if (!m.verification.correction_note && !m.verification.issues.length) return "";

  return `<div class="part">
  <div class="part-opener">
    <div class="part-label">Part Ⅴ</div>
    <h2>검증 노트</h2>
  </div>
  <p class="body">아래 사항들이 원문 대조 과정에서 제기되었습니다. 독자의 판단을 돕기 위해 그대로 수록합니다.</p>
  <div class="verification-box">
    ${m.verification.correction_note ? `<pre>${escapeHtml(m.verification.correction_note)}</pre>` : ""}
    ${
      m.verification.issues.length
        ? `<ul style="margin-top:3mm; padding-left:5mm;">${m.verification.issues
            .map(
              (i) => `<li style="margin-bottom:2mm;"><strong>${escapeHtml(i.section)}:</strong> ${escapeHtml(i.description)}${
                i.suggested_fix ? ` <em>(제안: ${escapeHtml(i.suggested_fix)})</em>` : ""
              }</li>`,
            )
            .join("")}</ul>`
        : ""
    }
  </div>
</div>`;
}
