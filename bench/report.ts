// Read bench/results/{v1,v2.5}/{textId}.json + extract quantitative metrics
// + render a markdown comparison table to bench/reports/{date}-v1-vs-v2.5.md

import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(__dirname);

interface Metrics {
  textId: string;
  blocks: number;
  blocksRevised: number;
  blocksWithVocab: number;
  blocksWithCulturalRefs: number;
  blocksWithSymbolism: number;
  blocksWithLiteraryDevices: number;
  totalKoreanChars: number;
  totalEnglishChars: number;
  synthesisCoreChars: number;
  multiPerspectiveChars: number;
  hasComplementaryInsights: number;
  hasUnresolvedTensions: number;
  hasCulturalPitfalls: boolean;
  hasKoreanLitParallels: boolean;
  discussionQuestionsCount: number;
  glossaryUniqueTerms: number;
  characterCount: number;
  symbolismProfileCount: number;
  culturalRefsProfileCount: number;
  verifyStatus: string;
  verifyVerified: boolean;
  generationTimeS: number;
}

function loadCorpus(): { id: string; title: string; size_class: string }[] {
  const raw = readFileSync(join(ROOT, "texts", "corpus.json"), "utf8");
  return (JSON.parse(raw) as { texts: { id: string; title: string; size_class: string }[] }).texts;
}

function safeStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function safeArr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function extractMetrics(textId: string, tm: Record<string, unknown>): Metrics {
  const blocks = safeArr<Record<string, unknown>>(tm.blocks);
  let blocksRevised = 0;
  let blocksWithVocab = 0;
  let blocksWithCulturalRefs = 0;
  let blocksWithSymbolism = 0;
  let blocksWithLiteraryDevices = 0;
  let totalKoreanChars = 0;
  let totalEnglishChars = 0;
  const glossaryTerms = new Set<string>();
  for (const b of blocks) {
    if (b.revised_literary_translation) blocksRevised++;
    const a = (b.annotations ?? {}) as Record<string, unknown>;
    const vocab = safeArr<{ en?: string }>(a.key_vocabulary);
    if (vocab.length) blocksWithVocab++;
    for (const v of vocab) {
      if (v.en) glossaryTerms.add(v.en.toLowerCase().trim());
    }
    if (safeArr(a.culturalReferences).length) blocksWithCulturalRefs++;
    if (safeArr(a.symbolismPresent).length) blocksWithSymbolism++;
    if (safeArr(a.literaryDevices).length) blocksWithLiteraryDevices++;
    totalEnglishChars += safeStr(b.originalText).length;
    totalKoreanChars += safeStr(
      b.revised_literary_translation || b.literary_translation,
    ).length;
  }

  const synthesis = (tm.synthesis ?? {}) as Record<string, unknown>;
  // v1/v2 baseline core synthesis fields (string fields *_ko)
  const coreStrFields = [
    "thesis_ko",
    "overview_essay_ko",
    "cultural_notes_ko",
    "plot_reading_ko",
    "reading_guide_ko",
    "style_essay_ko",
    "tone_flow_ko",
    "closing_note_ko",
  ];
  let synthesisCoreChars = 0;
  for (const f of coreStrFields) {
    synthesisCoreChars += safeStr(synthesis[f]).length;
  }
  // Object/array fields — sum stringified lengths to approximate content density
  for (const f of ["character_readings", "symbolism_readings", "twist_reading"]) {
    if (synthesis[f] !== undefined) {
      synthesisCoreChars += JSON.stringify(synthesis[f]).length;
    }
  }

  const multiPerspective = safeStr(synthesis.multi_perspective_synthesis_ko);
  const ci = safeArr(synthesis.complementary_insights);
  const ut = safeArr(synthesis.unresolved_tensions);
  const ped = (synthesis.pedagogical_scaffolding ?? {}) as Record<
    string,
    unknown
  >;
  const culturalPitfalls = safeStr(ped.cultural_pitfalls_ko);
  const korParallels = safeStr(ped.korean_literature_parallels_ko);
  const discussionQ = safeArr(ped.discussion_questions_ko);

  const profile = (tm.profile ?? {}) as Record<string, unknown>;
  const characters = safeArr(profile.characters);
  const symbolism = safeArr(profile.symbolism);
  const culturalContext = (profile.cultural_context ?? {}) as Record<
    string,
    unknown
  >;
  const culturalRefsProfile = safeArr(culturalContext.references);

  const verification = (tm.verification ?? {}) as Record<string, unknown>;
  const verifyStatus = safeStr(verification.status) || "UNCERTAIN";
  const verifyVerified = verification.verified === true;

  const meta = (tm.metadata ?? {}) as Record<string, unknown>;
  const generationTimeS =
    typeof meta.generation_time_s === "number" ? meta.generation_time_s : 0;

  return {
    textId,
    blocks: blocks.length,
    blocksRevised,
    blocksWithVocab,
    blocksWithCulturalRefs,
    blocksWithSymbolism,
    blocksWithLiteraryDevices,
    totalKoreanChars,
    totalEnglishChars,
    synthesisCoreChars,
    multiPerspectiveChars: multiPerspective.length,
    hasComplementaryInsights: ci.length,
    hasUnresolvedTensions: ut.length,
    hasCulturalPitfalls: !!culturalPitfalls,
    hasKoreanLitParallels: !!korParallels,
    discussionQuestionsCount: discussionQ.length,
    glossaryUniqueTerms: glossaryTerms.size,
    characterCount: characters.length,
    symbolismProfileCount: symbolism.length,
    culturalRefsProfileCount: culturalRefsProfile.length,
    verifyStatus,
    verifyVerified,
    generationTimeS,
  };
}

function loadResultMetrics(
  version: "v1" | "v2.5",
  textId: string,
): Metrics | null {
  const path = join(ROOT, "results", version, `${textId}.json`);
  if (!existsSync(path)) return null;
  try {
    const tm = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    return extractMetrics(textId, tm);
  } catch {
    return null;
  }
}

function fmt(n: number): string {
  if (n >= 1000) return n.toLocaleString();
  return String(n);
}

function pctOf(numerator: number, denominator: number): string {
  if (!denominator) return "—";
  return `${((numerator / denominator) * 100).toFixed(0)}%`;
}

function delta(v1: number | undefined, v25: number | undefined): string {
  if (v1 === undefined || v25 === undefined) return "—";
  if (v1 === 0 && v25 === 0) return "0";
  const d = v25 - v1;
  const sign = d > 0 ? "+" : "";
  if (v1 === 0) return `+${fmt(v25)}`;
  const pct = ((v25 / v1 - 1) * 100).toFixed(0);
  return `${sign}${fmt(d)} (${pct.startsWith("-") ? "" : "+"}${pct}%)`;
}

function ratioCol(numerator: number, total: number): string {
  if (!total) return "—";
  return `${numerator}/${total} (${pctOf(numerator, total)})`;
}

function buildReport(): string {
  const corpus = loadCorpus();
  const date = new Date().toISOString().slice(0, 10);

  const v1: Record<string, Metrics | null> = {};
  const v25: Record<string, Metrics | null> = {};
  for (const c of corpus) {
    v1[c.id] = loadResultMetrics("v1", c.id);
    v25[c.id] = loadResultMetrics("v2.5", c.id);
  }

  const lines: string[] = [];
  lines.push(`# v1 ↔ v2.5 quality regression — ${date}`);
  lines.push("");
  lines.push(
    `Bench corpus: ${corpus.length} short stories, sized to exercise both single-shot and chunk-merge synthesis paths.`,
  );
  lines.push("");
  lines.push("Metrics extracted directly from saved TeachingMaterial JSON.");
  lines.push("");

  // Per-text summary
  for (const c of corpus) {
    const a = v1[c.id];
    const b = v25[c.id];
    lines.push(`## ${c.title} (${c.size_class})`);
    if (!a && !b) {
      lines.push("");
      lines.push("> _Both runs missing — bench did not capture results._");
      lines.push("");
      continue;
    }

    lines.push("");
    lines.push("| Metric | v1 | v2.5 | Δ |");
    lines.push("|---|---:|---:|---|");
    const m: Array<[string, number | undefined, number | undefined]> = [
      ["blocks", a?.blocks, b?.blocks],
      ["blocks revised", a?.blocksRevised, b?.blocksRevised],
      ["blocks w/ vocab", a?.blocksWithVocab, b?.blocksWithVocab],
      ["blocks w/ cultural refs", a?.blocksWithCulturalRefs, b?.blocksWithCulturalRefs],
      ["blocks w/ symbolism", a?.blocksWithSymbolism, b?.blocksWithSymbolism],
      ["blocks w/ literary devices", a?.blocksWithLiteraryDevices, b?.blocksWithLiteraryDevices],
      ["KO translation chars", a?.totalKoreanChars, b?.totalKoreanChars],
      ["synthesis core chars (8 fields)", a?.synthesisCoreChars, b?.synthesisCoreChars],
      ["multi-perspective essay chars", a?.multiPerspectiveChars, b?.multiPerspectiveChars],
      ["complementary insights", a?.hasComplementaryInsights, b?.hasComplementaryInsights],
      ["unresolved tensions", a?.hasUnresolvedTensions, b?.hasUnresolvedTensions],
      ["discussion questions", a?.discussionQuestionsCount, b?.discussionQuestionsCount],
      ["glossary unique terms", a?.glossaryUniqueTerms, b?.glossaryUniqueTerms],
      ["characters in profile", a?.characterCount, b?.characterCount],
      ["symbolism in profile", a?.symbolismProfileCount, b?.symbolismProfileCount],
      ["cultural refs in profile", a?.culturalRefsProfileCount, b?.culturalRefsProfileCount],
    ];
    for (const [label, av, bv] of m) {
      lines.push(
        `| ${label} | ${av === undefined ? "—" : fmt(av)} | ${bv === undefined ? "—" : fmt(bv)} | ${delta(av, bv)} |`,
      );
    }
    lines.push(
      `| Korean lit parallels | ${a ? (a.hasKoreanLitParallels ? "✓" : "—") : "—"} | ${b ? (b.hasKoreanLitParallels ? "✓" : "—") : "—"} | — |`,
    );
    lines.push(
      `| Cultural pitfalls section | ${a ? (a.hasCulturalPitfalls ? "✓" : "—") : "—"} | ${b ? (b.hasCulturalPitfalls ? "✓" : "—") : "—"} | — |`,
    );
    lines.push(
      `| Verify status | ${a?.verifyStatus ?? "—"} | ${b?.verifyStatus ?? "—"} | — |`,
    );
    lines.push(
      `| Generation time (s) | ${a?.generationTimeS?.toFixed(0) ?? "—"} | ${b?.generationTimeS?.toFixed(0) ?? "—"} | ${a && b ? `${(((b.generationTimeS - a.generationTimeS) / Math.max(a.generationTimeS, 1)) * 100).toFixed(0)}%` : "—"} |`,
    );
    lines.push("");
  }

  // Aggregate summary
  lines.push("## Aggregate (sum across all texts)");
  lines.push("");
  const agg = (
    accessor: (m: Metrics) => number,
  ): { v1: number; v25: number } => {
    let s1 = 0;
    let s2 = 0;
    for (const c of corpus) {
      if (v1[c.id]) s1 += accessor(v1[c.id]!);
      if (v25[c.id]) s2 += accessor(v25[c.id]!);
    }
    return { v1: s1, v25: s2 };
  };
  const agglines: Array<[string, (m: Metrics) => number]> = [
    ["blocks total", (m) => m.blocks],
    ["KO translation chars", (m) => m.totalKoreanChars],
    ["synthesis core chars", (m) => m.synthesisCoreChars],
    ["multi-perspective essay chars", (m) => m.multiPerspectiveChars],
    ["complementary insights", (m) => m.hasComplementaryInsights],
    ["unresolved tensions", (m) => m.hasUnresolvedTensions],
    ["discussion questions", (m) => m.discussionQuestionsCount],
    ["generation time (s)", (m) => m.generationTimeS],
  ];
  lines.push("| Metric | v1 | v2.5 | Δ |");
  lines.push("|---|---:|---:|---|");
  for (const [label, fn] of agglines) {
    const { v1: s1, v25: s2 } = agg(fn);
    lines.push(`| ${label} | ${fmt(s1)} | ${fmt(s2)} | ${delta(s1, s2)} |`);
  }
  lines.push("");

  // Bench artifacts
  lines.push("## Bench artifacts");
  lines.push("");
  lines.push("- Texts: `bench/texts/` (UTF-8, Project Gutenberg sources)");
  lines.push("- Captured analyses: `bench/results/{v1,v2.5}/{text-id}.json`");
  lines.push("- Run logs: `bench/results/runlog-*.json`");
  lines.push("- Runner: `bench/run-bench.ts`");
  lines.push("- Report generator: `bench/report.ts`");

  return lines.join("\n") + "\n";
}

function main() {
  const out = buildReport();
  const date = new Date().toISOString().slice(0, 10);
  const reportsDir = join(ROOT, "reports");
  if (!existsSync(reportsDir)) {
    require("fs").mkdirSync(reportsDir, { recursive: true });
  }
  const path = join(reportsDir, `${date}-v1-vs-v2.5.md`);
  writeFileSync(path, out, "utf8");
  console.log(`Report written: ${path}`);
  console.log("");
  console.log(out);
}

main();
