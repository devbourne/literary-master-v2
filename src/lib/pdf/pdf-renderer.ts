import type { TeachingMaterial } from "../schemas/teaching-material";
import { PDF_CSS } from "./css";
import { renderCover } from "./sections/cover";
import { renderTitlePage } from "./sections/titlepage";
import { renderContents } from "./sections/contents";
import { renderOverview } from "./sections/overview";
import { renderBilingual } from "./sections/bilingual";
import { renderSynthesis } from "./sections/synthesis-essay";
import { renderGlossary } from "./sections/glossary";
import { renderVerification } from "./sections/verification";
import { renderColophon } from "./sections/colophon";

export function buildTeachingMaterialHtml(m: TeachingMaterial): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@400;500;600;700&family=Crimson+Pro:ital,wght@0,400;0,500;0,700;1,400;1,600;1,700&family=EB+Garamond:ital,wght@0,400;0,700;1,400;1,600&display=block" rel="stylesheet">
<style>${PDF_CSS}</style>
</head>
<body>
${renderCover(m)}
${renderTitlePage(m)}
${renderContents(m)}
${renderOverview(m)}
${renderBilingual(m)}
${renderSynthesis(m)}
${renderGlossary(m)}
${renderVerification(m)}
${renderColophon(m)}
</body>
</html>`;
}
