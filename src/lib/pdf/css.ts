export const PDF_CSS = `
@page {
  size: A4;
  margin: 22mm 20mm 22mm 20mm;
}
@page :first {
  margin: 0;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  background: #fffdf8;
}

body {
  font-family: "Noto Serif KR", "Crimson Pro", "EB Garamond", Georgia, serif;
  font-size: 10.5pt;
  line-height: 1.65;
  color: #1a1714;
  font-display: block;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}

/* Korean default: prevent mid-eojeol breaks */
body { word-break: keep-all; overflow-wrap: break-word; }
.en, .en-body, .en-quote, .quote-en, .bi-en, .vocab-term, .vocab-pos,
.serif-en, .display-en {
  font-family: "Crimson Pro", "EB Garamond", Georgia, "Noto Serif KR", serif;
  font-feature-settings: "liga" 1, "kern" 1, "onum" 1;
  hyphens: auto;
  -webkit-hyphens: auto;
  word-break: normal;
}

/* ── Part structure ─────────────────────────── */
.part {
  page-break-before: always;
  padding: 0;
}
.part:first-of-type {
  page-break-before: auto;
}

/* ── Cover (full-bleed page) ────────────────── */
.cover {
  height: 297mm;
  width: 210mm;
  margin: 0;
  padding: 0;
  page-break-after: always;
  color: #2a2219;
  background: #f4ead5;
}
.cover-bleed {
  position: relative;
  height: 297mm;
  width: 210mm;
  padding: 28mm 24mm 22mm;
  background:
    radial-gradient(120% 80% at 50% 0%, #fff8ea 0%, #f4ead5 55%, #ecdfc1 100%);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-sizing: border-box;
  overflow: hidden;
}
.cover-corner {
  position: absolute;
  width: 22mm;
  height: 22mm;
  border-color: #6b5a3e;
  border-style: solid;
  border-width: 0;
}
.cover-corner.tl { top: 14mm; left: 14mm; border-top-width: 0.6pt; border-left-width: 0.6pt; }
.cover-corner.tr { top: 14mm; right: 14mm; border-top-width: 0.6pt; border-right-width: 0.6pt; }
.cover-corner.bl { bottom: 14mm; left: 14mm; border-bottom-width: 0.6pt; border-left-width: 0.6pt; }
.cover-corner.br { bottom: 14mm; right: 14mm; border-bottom-width: 0.6pt; border-right-width: 0.6pt; }
.cover-header {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  font-size: 8pt;
  letter-spacing: 0.3em;
  color: #6b5a3e;
  font-variant-caps: all-small-caps;
  font-weight: 600;
  z-index: 2;
}
.cover-house { font-weight: 700; }
.cover-house-meta { font-style: italic; letter-spacing: 0.18em; }
.cover-title-block {
  position: relative;
  margin-top: 24mm;
  text-align: center;
  z-index: 2;
}
.cover-label {
  font-family: "Crimson Pro", "Noto Serif KR", serif;
  font-size: 9pt;
  letter-spacing: 0.42em;
  color: #7a6339;
  font-variant-caps: all-small-caps;
  margin-bottom: 6mm;
}
.cover-fleuron-top, .cover-fleuron-bottom {
  font-family: "EB Garamond", "Crimson Pro", serif;
  color: #8b7355;
  text-align: center;
  line-height: 1;
}
.cover-fleuron-top {
  font-size: 22pt;
  margin-bottom: 6mm;
  letter-spacing: 0.4em;
}
.cover-fleuron-bottom {
  font-size: 14pt;
  margin: 10mm 0 6mm;
  letter-spacing: 0.5em;
}
.cover-title {
  font-family: "Noto Serif KR", serif;
  font-size: 36pt;
  font-weight: 700;
  line-height: 1.12;
  letter-spacing: -0.01em;
  margin: 0 auto 8mm;
  color: #1a1510;
  max-width: 150mm;
}
.cover-rule {
  width: 36mm;
  height: 0.8pt;
  background: #6b5a3e;
  margin: 6mm auto 8mm;
}
.cover-author {
  font-family: "Crimson Pro", "Noto Serif KR", serif;
  font-size: 14pt;
  color: #2a2219;
  letter-spacing: 0.1em;
  font-variant-caps: small-caps;
  font-weight: 500;
  margin-bottom: 12mm;
}
.cover-motto {
  font-family: "Noto Serif KR", serif;
  font-size: 11pt;
  color: #4a3d28;
  font-style: normal;
  line-height: 1.6;
  max-width: 130mm;
  margin: 0 auto 4mm;
  letter-spacing: 0.02em;
}
.cover-edition {
  font-family: "Crimson Pro", "Noto Serif KR", serif;
  font-size: 10pt;
  color: #6b5a3e;
  letter-spacing: 0.22em;
  font-variant-caps: all-small-caps;
  margin-top: 4mm;
}
.cover-footer {
  position: relative;
  text-align: center;
  font-size: 8.5pt;
  color: #6b5a3e;
  line-height: 1.7;
  font-variant-caps: all-small-caps;
  letter-spacing: 0.18em;
  z-index: 2;
}
.cover-imprint {
  font-family: "Crimson Pro", serif;
  font-size: 10pt;
  color: #4a3d28;
  letter-spacing: 0.12em;
  margin-bottom: 2mm;
  font-variant-caps: small-caps;
  display: flex;
  justify-content: center;
  align-items: baseline;
  gap: 0.5em;
}
.cover-imprint-sep { color: #b8a87f; }
.cover-date {
  font-family: "Crimson Pro", serif;
  font-size: 8.5pt;
  letter-spacing: 0.16em;
}

/* ── Title page (recto) ─────────────────────── */
.titlepage {
  min-height: 240mm;
  padding: 40mm 15mm 20mm;
  text-align: center;
  page-break-after: always;
  page-break-before: always;
}
.titlepage h1 {
  font-family: "Noto Serif KR", serif;
  font-size: 28pt;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 10mm;
  color: #1a1510;
}
.titlepage .author {
  font-family: "Crimson Pro", "Noto Serif KR", serif;
  font-size: 14pt;
  letter-spacing: 0.1em;
  font-variant-caps: small-caps;
  color: #3a3024;
  margin-bottom: 28mm;
}
.titlepage .fleuron {
  margin: 10mm auto;
}
.titlepage .imprint {
  margin-top: auto;
  font-size: 9pt;
  font-variant-caps: all-small-caps;
  letter-spacing: 0.22em;
  color: #6b5a3e;
  line-height: 1.8;
}

/* ── Fleuron (ornamental divider) ──────────── */
.fleuron {
  text-align: center;
  margin: 8mm auto;
  color: #8b7355;
  font-size: 12pt;
  letter-spacing: 0.6em;
  page-break-inside: avoid;
}
.fleuron::before {
  content: "❦   ❦   ❦";
}

/* ── Contents ───────────────────────────────── */
.contents {
  padding-top: 4mm;
}
.part-label {
  font-family: "Crimson Pro", "Noto Serif KR", serif;
  font-size: 9pt;
  font-variant-caps: all-small-caps;
  letter-spacing: 0.35em;
  color: #8b7355;
  margin-bottom: 4mm;
}
.section-title {
  font-family: "Noto Serif KR", serif;
  font-size: 22pt;
  font-weight: 700;
  line-height: 1.15;
  margin-bottom: 10mm;
  color: #1a1510;
}
.section-intro {
  font-size: 10pt;
  color: #5c4f3f;
  font-style: italic;
  margin: 0 0 8mm;
  max-width: 150mm;
}
.toc-list {
  list-style: none;
  margin-top: 6mm;
}
.toc-roman {
  display: inline-block;
  width: 12mm;
  font-family: "Crimson Pro", serif;
  color: #8b7355;
  font-size: 10pt;
  font-variant-caps: small-caps;
  letter-spacing: 0.1em;
}
.toc-item {
  display: flex;
  align-items: baseline;
  padding: 3mm 0;
  border-bottom: 0.3pt dotted #bfae8f;
  font-size: 11pt;
}
.toc-item-title {
  font-weight: 500;
  flex: 1;
}
.toc-item-subtitle {
  font-size: 9pt;
  color: #7a6b57;
  margin-left: 3mm;
  font-style: italic;
}

/* ── Section headings (Part openers) ────────── */
.part-opener {
  page-break-before: always;
  padding-top: 20mm;
  padding-bottom: 8mm;
  border-bottom: 0.5pt solid #3a3024;
  margin-bottom: 10mm;
}
.part-opener .part-label {
  margin-bottom: 3mm;
}
.part-opener h2 {
  font-family: "Noto Serif KR", serif;
  font-size: 24pt;
  font-weight: 700;
  line-height: 1.15;
  color: #1a1510;
}

h3.subsection {
  font-family: "Noto Serif KR", serif;
  font-size: 14pt;
  font-weight: 700;
  margin: 10mm 0 3mm;
  color: #1a1510;
  line-height: 1.3;
}
h3.subsection .num {
  font-family: "Crimson Pro", serif;
  color: #8b7355;
  font-size: 12pt;
  margin-right: 3mm;
  font-variant-caps: small-caps;
  letter-spacing: 0.1em;
}

h4.minor {
  font-family: "Noto Serif KR", serif;
  font-size: 11.5pt;
  font-weight: 700;
  margin: 6mm 0 2mm;
  color: #2a2219;
}

/* ── Body typography ────────────────────────── */
p {
  margin: 0 0 2.8mm;
  orphans: 3;
  widows: 3;
}
p.body {
  text-indent: 4mm;
}
p.body:first-of-type, h3 + p.body, h4 + p.body, .lead + p.body {
  text-indent: 0;
}
p.lead {
  font-size: 11pt;
  line-height: 1.7;
  margin-bottom: 4mm;
  color: #2a2219;
}
.dropcap::first-letter {
  font-family: "Crimson Pro", "EB Garamond", serif;
  float: left;
  font-size: 4.6em;
  line-height: 0.85;
  padding: 1.5mm 2mm 0 0;
  font-weight: 700;
  color: #2a2219;
}

strong { font-weight: 700; color: #1a1510; }
em { font-style: italic; }

/* ── Pull quote ─────────────────────────────── */
.pullquote {
  margin: 8mm 8mm;
  padding: 5mm 0;
  border-top: 0.6pt solid #3a3024;
  border-bottom: 0.6pt solid #3a3024;
  font-family: "Noto Serif KR", serif;
  font-style: italic;
  font-size: 12.5pt;
  line-height: 1.55;
  text-align: center;
  color: #2a2219;
  page-break-inside: avoid;
}

/* ── Epigraph (bilingual) ──────────────────── */
.epigraph {
  margin: 4mm 0 10mm 30mm;
  font-size: 10pt;
  color: #3a3024;
  line-height: 1.6;
  page-break-inside: avoid;
}
.epigraph .en {
  font-style: italic;
  margin-bottom: 1.5mm;
}
.epigraph .ko { color: #5c4f3f; }
.epigraph .attr {
  margin-top: 2mm;
  font-variant-caps: all-small-caps;
  letter-spacing: 0.16em;
  font-size: 8.5pt;
  color: #6b5a3e;
}
.epigraph .attr::before { content: "— "; }

/* ── Overview blocks ───────────────────────── */
.overview-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6mm 8mm;
  margin: 5mm 0 8mm;
}
.overview-cell {
  padding-left: 4mm;
  border-left: 1.5pt solid #8b7355;
}
.overview-cell-label {
  font-family: "Crimson Pro", serif;
  font-size: 8.5pt;
  font-variant-caps: all-small-caps;
  letter-spacing: 0.2em;
  color: #8b7355;
  margin-bottom: 1.5mm;
}
.overview-cell-body {
  font-size: 10pt;
  line-height: 1.6;
}

/* ── Tables (cast, plot, etc.) ────────────── */
.book-table {
  width: 100%;
  border-collapse: collapse;
  margin: 4mm 0 8mm;
  font-size: 9.5pt;
  line-height: 1.55;
}
.book-table caption {
  font-family: "Crimson Pro", serif;
  font-variant-caps: all-small-caps;
  letter-spacing: 0.2em;
  font-size: 9pt;
  color: #8b7355;
  margin-bottom: 2mm;
  text-align: left;
}
.book-table th {
  border-top: 0.8pt solid #1a1510;
  border-bottom: 0.4pt solid #1a1510;
  padding: 2mm 3mm;
  text-align: left;
  font-weight: 700;
  font-size: 9pt;
  font-variant-caps: all-small-caps;
  letter-spacing: 0.12em;
  color: #1a1510;
  background: transparent;
}
.book-table td {
  padding: 2mm 3mm;
  border-bottom: 0.3pt solid #d6cab0;
  vertical-align: top;
}
.book-table tr:last-child td {
  border-bottom: 0.8pt solid #1a1510;
}
.book-table tbody tr:nth-child(even) td { background: #faf5e8; }

/* ── Plot timeline (vertical) ─────────────── */
.plot-timeline {
  margin: 4mm 0 8mm;
  border-left: 0.8pt solid #8b7355;
  padding-left: 6mm;
}
.plot-stage {
  position: relative;
  padding: 2mm 0 3mm;
  page-break-inside: avoid;
}
.plot-stage::before {
  content: "";
  position: absolute;
  left: -8.6mm;
  top: 3mm;
  width: 2.2mm;
  height: 2.2mm;
  background: #8b7355;
  border-radius: 50%;
}
.plot-stage-label {
  font-family: "Crimson Pro", serif;
  font-variant-caps: all-small-caps;
  letter-spacing: 0.18em;
  color: #8b7355;
  font-size: 9pt;
  margin-bottom: 1mm;
}
.plot-stage-summary { font-size: 10pt; line-height: 1.6; }
.plot-stage-evidence {
  margin-top: 1.5mm;
  font-family: "Crimson Pro", "Noto Serif KR", serif;
  font-style: italic;
  font-size: 9pt;
  color: #5c4f3f;
  line-height: 1.5;
}

/* ── Foreshadowing pairs ──────────────────── */
.pair-box {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4mm;
  padding: 3mm 4mm;
  border: 0.4pt solid #d6cab0;
  background: #faf5e8;
  margin-bottom: 4mm;
  font-size: 9.5pt;
  line-height: 1.55;
  page-break-inside: avoid;
}
.pair-label {
  font-family: "Crimson Pro", serif;
  font-variant-caps: all-small-caps;
  letter-spacing: 0.18em;
  color: #8b7355;
  font-size: 8.5pt;
  margin-bottom: 1.5mm;
}
.pair-effect {
  grid-column: 1 / -1;
  margin-top: 2mm;
  padding-top: 2mm;
  border-top: 0.3pt dotted #bfae8f;
  font-size: 9pt;
  color: #5c4f3f;
  font-style: italic;
}

/* ── Symbolism compact ────────────────────── */
.symbol-row {
  display: grid;
  grid-template-columns: 36mm 1fr;
  gap: 5mm;
  padding: 2.5mm 0;
  border-bottom: 0.3pt dotted #bfae8f;
  font-size: 10pt;
  line-height: 1.55;
  page-break-inside: avoid;
}
.symbol-row:last-child { border-bottom: 0; }
.symbol-name {
  font-family: "Noto Serif KR", serif;
  font-weight: 700;
  color: #1a1510;
}
.symbol-appearances {
  margin-top: 1mm;
  font-size: 8.5pt;
  font-style: italic;
  color: #6b5a3e;
}

/* ── Bilingual reader ─────────────────────── */
.bilingual-intro {
  font-style: italic;
  color: #5c4f3f;
  margin-bottom: 8mm;
  font-size: 10pt;
  line-height: 1.65;
}
.bi-pair {
  margin: 0 0 8mm;
  position: relative;
}
.bi-pair-marker {
  font-family: "Crimson Pro", serif;
  font-size: 8.5pt;
  font-variant-caps: all-small-caps;
  letter-spacing: 0.22em;
  color: #8b7355;
  margin-bottom: 1.5mm;
  display: flex;
  align-items: center;
  gap: 4mm;
}
.bi-pair-marker::after {
  content: "";
  flex: 1;
  height: 0.3pt;
  background: #d6cab0;
}
.bi-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6mm;
  align-items: start;
  break-inside: avoid;
  page-break-inside: avoid;
}
.bi-en {
  font-family: "Crimson Pro", "EB Garamond", Georgia, serif;
  font-size: 10.8pt;
  line-height: 1.7;
  text-align: justify;
  hyphens: auto;
  color: #1a1510;
}
.bi-ko {
  font-family: "Noto Serif KR", serif;
  font-size: 10.2pt;
  line-height: 1.78;
  color: #1a1510;
  word-break: keep-all;
}
.bi-ko-literal {
  margin-top: 2mm;
  padding-top: 1.5mm;
  border-top: 0.3pt dotted #bfae8f;
  font-size: 9.2pt;
  line-height: 1.6;
  color: #5c4f3f;
}
.bi-ko-literal-label {
  font-variant-caps: all-small-caps;
  letter-spacing: 0.18em;
  font-size: 8pt;
  color: #8b7355;
  margin-right: 2mm;
}
.bi-commentary {
  margin-top: 3mm;
  padding: 2.5mm 3.5mm;
  background: #faf5e8;
  border-left: 1.5pt solid #8b7355;
  font-size: 9.5pt;
  line-height: 1.65;
  color: #3a3024;
  break-inside: avoid;
}
/* ── Bilingual: academic footnotes (numbered, hanging) ─── */
.bi-footnotes {
  list-style: none;
  margin: 4mm 0 0;
  padding: 2.5mm 0 0;
  border-top: 0.5pt solid #8b7355;
  counter-reset: bifn;
  font-size: 8.8pt;
  line-height: 1.55;
  color: #2a2219;
  column-count: 2;
  column-gap: 6mm;
  column-rule: 0.3pt dotted #d6cab0;
}
.bi-fn {
  break-inside: avoid;
  -webkit-column-break-inside: avoid;
  page-break-inside: avoid;
  padding: 0.6mm 0;
  display: grid;
  grid-template-columns: 4mm 11mm 1fr;
  gap: 1.2mm;
}
.bi-fn-marker {
  font-family: "Crimson Pro", serif;
  font-weight: 700;
  font-size: 7.5pt;
  color: #8b7355;
  text-align: right;
  padding-top: 0.3mm;
  font-feature-settings: "sups";
}
.bi-fn-label {
  font-variant-caps: all-small-caps;
  letter-spacing: 0.14em;
  color: #8b7355;
  font-weight: 700;
  font-size: 7.8pt;
  padding-top: 0.3mm;
}
.bi-fn-body {
  color: #2a2219;
  text-indent: 0;
}
.bi-fn-body .en {
  font-family: "Crimson Pro", "Noto Serif KR", serif;
  font-style: italic;
  color: #1a1510;
}
.bi-fn-body b {
  font-family: "Crimson Pro", "Noto Serif KR", serif;
  font-style: italic;
  font-weight: 700;
}

/* ── Bilingual: vocabulary chip bar (above bi-row) ─── */
.bi-margin-vocab {
  margin: 1mm 0 2mm;
  padding: 1.8mm 2.5mm 1.8mm 3mm;
  background: #fbf6e9;
  border-left: 1.5pt solid #c9b88f;
  border-radius: 0 1mm 1mm 0;
  font-family: "Noto Sans KR", "Crimson Pro", sans-serif;
  font-size: 8pt;
  line-height: 1.45;
  color: #3a3024;
  page-break-inside: avoid;
  break-inside: avoid;
  display: grid;
  grid-template-columns: 9mm 1fr;
  gap: 2mm;
  align-items: start;
}
.mv-head {
  font-family: "Crimson Pro", "Noto Serif KR", serif;
  font-variant-caps: all-small-caps;
  letter-spacing: 0.18em;
  font-weight: 700;
  color: #8b7355;
  font-size: 7.4pt;
  padding-top: 0.4mm;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.3;
}
.mv-head-en {
  font-style: italic;
  font-weight: 400;
  color: #b8a87f;
  letter-spacing: 0.1em;
  font-size: 6.5pt;
  margin-top: 0.5mm;
}
.mv-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0 5mm;
}
.mv-item {
  padding: 0.4mm 0;
  flex: 0 1 auto;
  min-width: 0;
}
.mv-en {
  font-family: "Crimson Pro", "EB Garamond", serif;
  font-weight: 700;
  font-style: italic;
  color: #1a1510;
  margin-right: 1mm;
}
.mv-pos {
  font-style: italic;
  color: #8b7355;
  font-size: 6.8pt;
  margin-right: 1mm;
}
.mv-ko {
  color: #2a2219;
  margin-right: 0.5mm;
}
.mv-ctx {
  font-style: italic;
  color: #6b5a3e;
  font-size: 7.2pt;
  margin-left: 0.5mm;
}

/* ── Synthesis essay (Part III) ───────────── */
.synthesis-section {
  margin-bottom: 10mm;
}
.synthesis-prose {
  font-size: 10.5pt;
  line-height: 1.75;
  text-align: justify;
}
.synthesis-quote {
  margin: 4mm 6mm;
  padding: 2.5mm 0 2.5mm 5mm;
  border-left: 1.5pt solid #8b7355;
  font-size: 10pt;
  line-height: 1.65;
  page-break-inside: avoid;
}
.synthesis-quote .en {
  font-family: "Crimson Pro", "Noto Serif KR", serif;
  font-style: italic;
  color: #1a1510;
  margin-bottom: 1.5mm;
}
.synthesis-quote .ko { color: #2a2219; margin-bottom: 1.5mm; }
.synthesis-quote .note {
  font-size: 9pt;
  color: #5c4f3f;
  font-style: italic;
}
.reading-guide {
  list-style: none;
  counter-reset: rg;
  margin: 2mm 0 4mm;
}
.reading-guide li {
  counter-increment: rg;
  padding: 2.5mm 0 2.5mm 10mm;
  position: relative;
  font-size: 10.2pt;
  line-height: 1.7;
  border-bottom: 0.3pt dotted #bfae8f;
  break-inside: avoid;
}
.reading-guide li:last-child { border-bottom: 0; }
.reading-guide li::before {
  content: counter(rg);
  position: absolute;
  left: 0;
  top: 2.5mm;
  width: 6mm;
  height: 6mm;
  line-height: 6mm;
  text-align: center;
  background: #2a2219;
  color: #faf5e8;
  border-radius: 50%;
  font-family: "Crimson Pro", serif;
  font-size: 9pt;
  font-weight: 700;
}

/* ── Glossary (vocabulary index) ──────────── */
.glossary-intro {
  font-style: italic;
  color: #5c4f3f;
  font-size: 10pt;
  margin-bottom: 6mm;
}
.glossary {
  columns: 2;
  column-gap: 8mm;
  column-rule: 0.3pt solid #d6cab0;
}
.vocab-item {
  break-inside: avoid;
  margin-bottom: 4mm;
  font-size: 9.6pt;
  line-height: 1.5;
  padding: 0 2mm 0 0;
}
.vocab-term {
  font-family: "Crimson Pro", "Noto Serif KR", serif;
  font-weight: 700;
  color: #1a1510;
  font-size: 10pt;
}
.vocab-pos {
  font-family: "Crimson Pro", serif;
  font-style: italic;
  color: #8b7355;
  font-size: 8.5pt;
  margin-left: 2mm;
}
.vocab-gloss {
  display: block;
  margin-top: 0.5mm;
  color: #2a2219;
}
.vocab-context {
  display: block;
  margin-top: 0.5mm;
  font-family: "Crimson Pro", "Noto Serif KR", serif;
  font-style: italic;
  color: #5c4f3f;
  font-size: 8.8pt;
}

/* ── Verification note ───────────────────── */
.verification-box {
  padding: 5mm;
  background: #fdf6e3;
  border: 0.4pt solid #c7a96b;
  border-left: 2pt solid #a9862e;
  font-size: 9.5pt;
  line-height: 1.6;
  color: #3a2d10;
}
.verification-box strong {
  font-variant-caps: all-small-caps;
  letter-spacing: 0.16em;
  color: #a9862e;
}
.verification-box pre {
  white-space: pre-wrap;
  font-family: inherit;
  margin-top: 2.5mm;
}

/* ── Colophon ────────────────────────────── */
.colophon {
  page-break-before: always;
  min-height: 220mm;
  padding: 60mm 20mm 20mm;
  text-align: center;
  font-size: 9pt;
  color: #5c4f3f;
  font-variant-caps: all-small-caps;
  letter-spacing: 0.24em;
  line-height: 2.2;
}
.colophon .fleuron { margin: 12mm 0; }
.colophon .title-small {
  font-family: "Noto Serif KR", serif;
  font-size: 11pt;
  font-variant-caps: normal;
  letter-spacing: 0.01em;
  color: #1a1510;
  margin-bottom: 8mm;
}
.colophon .meta {
  font-family: "Crimson Pro", serif;
  font-size: 8.5pt;
  letter-spacing: 0.22em;
}

/* ── Utilities ───────────────────────────── */
.small-caps {
  font-variant-caps: all-small-caps;
  letter-spacing: 0.14em;
}
.quoted-en {
  font-family: "Crimson Pro", "Noto Serif KR", serif;
  font-style: italic;
}

/* ── Part Ⅳ Multi-Perspective ─────────────
   Distinct visual treatment from §1-§7 to mark this as the culminating
   integrative chapter (Part Ⅳ vs Part Ⅲ). Slightly tighter leading,
   warmer paper-tinted backgrounds for the insight/tension callouts,
   pull-quote dropcap on the meta essay. */

.mp-meta .body.synthesis-prose {
  font-size: 11.5pt;
  line-height: 1.78;
}

.mp-lead {
  color: #6b5d44;
  font-style: italic;
  font-size: 10.5pt;
  margin-bottom: 14pt;
}

.mp-insight-list {
  display: flex;
  flex-direction: column;
  gap: 12pt;
  margin-top: 8pt;
}

.mp-insight {
  background: #fbf6ec;
  border-left: 2pt solid #c9b890;
  padding: 10pt 14pt 10pt 14pt;
  break-inside: avoid;
}

.mp-anglepair {
  font-variant-caps: all-small-caps;
  letter-spacing: 0.18em;
  font-weight: 600;
  font-size: 8.8pt;
  color: #8b7355;
  margin-bottom: 4pt;
  font-family: "Crimson Pro", "Noto Serif KR", serif;
}

.mp-insight .body.synthesis-prose {
  font-size: 10.5pt;
  line-height: 1.65;
  margin: 0;
}

.mp-tension-list {
  list-style: none;
  margin: 8pt 0 0 0;
  padding: 0;
}

.mp-tension {
  display: grid;
  grid-template-columns: 24pt 1fr;
  gap: 12pt;
  padding: 14pt 0;
  border-bottom: 0.4pt solid #e6dcc4;
  break-inside: avoid;
}

.mp-tension:last-child {
  border-bottom: none;
}

.mp-tension-no {
  font-family: "Crimson Pro", serif;
  font-style: italic;
  font-size: 14pt;
  color: #8b7355;
  text-align: right;
  padding-top: 1pt;
}

.mp-tension-body .body.synthesis-prose {
  margin: 0;
}

.mp-verdict {
  margin-top: 8pt !important;
  padding-left: 12pt;
  border-left: 3pt solid #c9b890;
  font-size: 10.3pt;
  color: #3a3024;
}

.mp-verdict-label {
  font-variant-caps: all-small-caps;
  letter-spacing: 0.16em;
  font-weight: 700;
  color: #8b7355;
  margin-right: 6pt;
}

.mp-discussion {
  margin-top: 6pt;
}

.mp-discussion li {
  margin-bottom: 8pt;
  font-size: 10.5pt;
  line-height: 1.7;
}

/* ── Part h2 inline English label ─── */
.part-h2-en {
  font-family: "Crimson Pro", serif;
  font-style: italic;
  font-weight: 400;
  font-size: 0.55em;
  color: #8b7355;
  letter-spacing: 0.06em;
  margin-left: 0.3em;
}

/* ── Part-opener subtitle (used by back-index) ─── */
.part-opener-sub {
  font-style: italic;
  color: #5c4f3f;
  font-size: 10pt;
  line-height: 1.6;
  max-width: 130mm;
  margin: 4mm auto 0;
}

/* ── Back-matter Index (Index part) ─────────── */
.part-index .part-label { color: #8b7355; }
.idx-grid {
  margin-top: 8mm;
  display: grid;
  grid-template-columns: 1fr;
  gap: 10mm;
}
.idx-column {
  break-inside: avoid;
  page-break-inside: avoid;
}
.idx-col-title {
  display: flex;
  align-items: baseline;
  gap: 4mm;
  font-family: "Noto Serif KR", serif;
  font-size: 14pt;
  font-weight: 700;
  color: #1a1510;
  margin: 0 0 3mm;
  padding-bottom: 1.5mm;
  border-bottom: 0.6pt solid #8b7355;
}
.idx-col-title-en {
  font-family: "Crimson Pro", serif;
  font-size: 9pt;
  font-style: italic;
  font-weight: 500;
  color: #8b7355;
  letter-spacing: 0.06em;
}
.idx-col-count {
  margin-left: auto;
  font-family: "Crimson Pro", serif;
  font-size: 8pt;
  font-variant-caps: all-small-caps;
  letter-spacing: 0.18em;
  color: #b8a87f;
  font-weight: 500;
}
.idx-list {
  list-style: none;
  margin: 0;
  padding: 0;
  column-count: 2;
  column-gap: 8mm;
  column-rule: 0.3pt dotted #d6cab0;
  font-size: 9pt;
  line-height: 1.5;
}
.idx-entry {
  break-inside: avoid;
  -webkit-column-break-inside: avoid;
  page-break-inside: avoid;
  padding: 0.8mm 0;
  border-bottom: 0.3pt dotted #ebe0c7;
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  column-gap: 2mm;
}
.idx-term {
  font-family: "Crimson Pro", "Noto Serif KR", serif;
  font-weight: 700;
  color: #1a1510;
  font-size: 9.2pt;
  grid-column: 1;
  grid-row: 1;
}
.idx-pointer {
  font-family: "Crimson Pro", serif;
  font-style: italic;
  color: #8b7355;
  font-size: 7.8pt;
  font-variant-caps: all-small-caps;
  letter-spacing: 0.1em;
  grid-column: 2;
  grid-row: 1;
  text-align: right;
  align-self: baseline;
}
.idx-ko {
  grid-column: 1 / -1;
  grid-row: 2;
  color: #4a3d28;
  font-size: 8.4pt;
  margin-top: 0.3mm;
}
`;
