import type { TeachingMaterial } from "../../schemas/teaching-material";

const ROMAN = ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ", "Ⅸ", "Ⅹ"];

export interface PartLabels {
  overview: string;
  bilingual: string;
  synthesis: string;
  multiPerspective: string | null;
  glossary: string;
  index: string | null;
  verification: string | null;
}

function hasMultiPerspective(m: TeachingMaterial): boolean {
  const s = m.synthesis;
  if (!s) return false;
  if (s.multi_perspective_synthesis_ko) return true;
  if (s.complementary_insights.length > 0) return true;
  if (s.unresolved_tensions.length > 0) return true;
  const ped = s.pedagogical_scaffolding;
  if (
    ped &&
    (!!ped.cultural_pitfalls_ko ||
      !!ped.korean_literature_parallels_ko ||
      ped.discussion_questions_ko.length > 0)
  )
    return true;
  return false;
}

export function hasIndexContent(m: TeachingMaterial): boolean {
  if (m.profile.characters.length) return true;
  if (m.profile.symbolism.length) return true;
  if (m.profile.cultural_context.references.length) return true;
  for (const b of m.blocks) {
    const a = b.annotations;
    if (
      a.symbolismPresent.length ||
      a.culturalReferences.length ||
      a.key_vocabulary.length
    )
      return true;
  }
  return false;
}

export function computePartLabels(m: TeachingMaterial): PartLabels {
  const slots: ("overview" | "bilingual" | "synthesis" | "multi" | "glossary" | "index" | "verification")[] = [
    "overview",
    "bilingual",
    "synthesis",
  ];
  if (hasMultiPerspective(m)) slots.push("multi");
  slots.push("glossary");
  if (hasIndexContent(m)) slots.push("index");
  if (!m.verification.verified && m.verification.correction_note)
    slots.push("verification");

  const out: PartLabels = {
    overview: "Ⅰ",
    bilingual: "Ⅱ",
    synthesis: "Ⅲ",
    multiPerspective: null,
    glossary: "Ⅳ",
    index: null,
    verification: null,
  };
  slots.forEach((slot, i) => {
    const r = ROMAN[i] ?? String(i + 1);
    if (slot === "overview") out.overview = r;
    else if (slot === "bilingual") out.bilingual = r;
    else if (slot === "synthesis") out.synthesis = r;
    else if (slot === "multi") out.multiPerspective = r;
    else if (slot === "glossary") out.glossary = r;
    else if (slot === "index") out.index = r;
    else if (slot === "verification") out.verification = r;
  });
  return out;
}
