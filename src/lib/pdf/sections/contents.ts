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
  ];
  // v2.5: Part Ⅳ 다관점 통합 only when multi-perspective fields populated.
  const s = m.synthesis;
  const hasMultiPerspective =
    !!s &&
    (!!s.multi_perspective_synthesis_ko ||
      s.complementary_insights.length > 0 ||
      s.unresolved_tensions.length > 0 ||
      (s.pedagogical_scaffolding &&
        (!!s.pedagogical_scaffolding.cultural_pitfalls_ko ||
          !!s.pedagogical_scaffolding.korean_literature_parallels_ko ||
          s.pedagogical_scaffolding.discussion_questions_ko.length > 0)));
  if (hasMultiPerspective) {
    entries.push({
      roman: "Ⅳ",
      title: "다관점 통합",
      subtitle: "Multi-Perspective Synthesis",
    });
  }
  entries.push({
    roman: hasMultiPerspective ? "Ⅴ" : "Ⅳ",
    title: "어휘 총람",
    subtitle: "Glossary",
  });
  if (!m.verification.verified && m.verification.correction_note) {
    entries.push({
      roman: hasMultiPerspective ? "Ⅵ" : "Ⅴ",
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
