import type { TeachingMaterial } from "../../schemas/teaching-material";

interface ContentsEntry {
  roman: string;
  title: string;
  subtitle: string;
}

export function renderContents(m: TeachingMaterial): string {
  const entries: ContentsEntry[] = [
    { roman: "Ⅰ", title: "작품 개관", subtitle: "Overview" },
    { roman: "Ⅱ", title: "이중언어 정밀 읽기", subtitle: "Bilingual Reader" },
    { roman: "Ⅲ", title: "종합 분석", subtitle: "Critical Synthesis" },
    { roman: "Ⅳ", title: "어휘 총람", subtitle: "Glossary" },
  ];
  if (!m.verification.verified && m.verification.correction_note) {
    entries.push({
      roman: "Ⅴ",
      title: "검증 노트",
      subtitle: "Verification",
    });
  }

  return `<div class="part contents">
  <div class="part-label">Contents</div>
  <h2 class="section-title">목차</h2>
  <ul class="toc-list">
    ${entries
      .map(
        (e) => `<li class="toc-item">
      <span class="toc-roman">${e.roman}</span>
      <span class="toc-item-title">${e.title}<span class="toc-item-subtitle">${e.subtitle}</span></span>
    </li>`,
      )
      .join("")}
  </ul>
</div>`;
}
