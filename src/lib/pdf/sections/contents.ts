import type { TeachingMaterial } from "../../schemas/teaching-material";
import { computePartLabels } from "./part-labels";

interface ContentsEntry {
  roman: string;
  title: string;
  subtitle: string;
}

export function renderContents(m: TeachingMaterial): string {
  const p = computePartLabels(m);
  const entries: ContentsEntry[] = [
    { roman: p.overview, title: "작품 개관", subtitle: "Overview" },
    { roman: p.bilingual, title: "이중언어 정밀 읽기", subtitle: "Bilingual Reader" },
    { roman: p.synthesis, title: "종합 분석", subtitle: "Critical Synthesis" },
  ];
  if (p.multiPerspective) {
    entries.push({
      roman: p.multiPerspective,
      title: "다관점 통합",
      subtitle: "Multi-Perspective Synthesis",
    });
  }
  entries.push({ roman: p.glossary, title: "어휘 총람", subtitle: "Glossary" });
  if (p.index) {
    entries.push({ roman: p.index, title: "색인", subtitle: "Index" });
  }
  if (p.verification) {
    entries.push({
      roman: p.verification,
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
