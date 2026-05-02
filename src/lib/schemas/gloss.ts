// v2.5 Multi-Gloss schemas — 3 perspective glosses dispatched in parallel
// after Coverage Repair, before Synthesis. Each gloss is produced by a
// model whose strength matches the angle, then merged INTO the existing
// Synthesis fields (no new top-level synthesis fields per the design).

import { z } from "zod";

// ── Angle 1: Textual close-reading ────────────────────────────────────────
// Generated in English by gpt-oss:120b (Round 4 winner on this axis), then
// translated to Korean by gemma4. Both kept; synthesis can use either.
export const TextualGlossSchema = z
  .object({
    english_analysis: z.string().default(""),
    korean_translation: z.string().default(""),
  })
  .passthrough();

// ── Angle 2: Critical / theoretical readings ─────────────────────────────
// Generated in Korean (JSON-structured) by qwen3:30b (JSON champion).
// Multiple critical traditions surfaced as discrete readings.
export const CriticalReadingSchema = z
  .object({
    tradition: z.string().default(""),
    thesis_ko: z.string().default(""),
    key_evidence_ko: z.string().default(""),
    tension_with_default: z.string().default(""),
  })
  .passthrough();

export const CriticalGlossSchema = z
  .object({
    critical_readings: z.array(CriticalReadingSchema).default([]),
  })
  .passthrough();

// ── Angle 3: Korean reader pedagogical ────────────────────────────────────
// Generated in Korean by gemma4 (Korean depth). Korean-reader-specific
// cultural pitfalls + Korean literary parallels + discussion seeds.
export const PedagogicalGlossSchema = z
  .object({
    cultural_pitfalls_ko: z.string().default(""),
    korean_literature_parallels_ko: z.string().default(""),
    discussion_questions_ko: z.array(z.string()).default([]),
  })
  .passthrough();

// ── Multi-gloss container ─────────────────────────────────────────────────
export const MultiGlossSchema = z
  .object({
    textual: TextualGlossSchema.default({
      english_analysis: "",
      korean_translation: "",
    }),
    critical: CriticalGlossSchema.default({ critical_readings: [] }),
    pedagogical: PedagogicalGlossSchema.default({
      cultural_pitfalls_ko: "",
      korean_literature_parallels_ko: "",
      discussion_questions_ko: [],
    }),
  })
  .passthrough();

export type TextualGloss = z.infer<typeof TextualGlossSchema>;
export type CriticalReading = z.infer<typeof CriticalReadingSchema>;
export type CriticalGloss = z.infer<typeof CriticalGlossSchema>;
export type PedagogicalGloss = z.infer<typeof PedagogicalGlossSchema>;
export type MultiGloss = z.infer<typeof MultiGlossSchema>;

/**
 * Render a multi-gloss object as a context block to inject into the synthesis
 * prompt. Synthesis still produces its existing schema; the multi-gloss is
 * read-only enrichment material.
 */
export function renderMultiGlossForSynthesisPrompt(g: MultiGloss): string {
  const lines: string[] = [];
  lines.push("## 다관점 글로스 (Synthesis 통합용 참고 자료)");
  lines.push("");
  lines.push("아래 세 관점은 서로 다른 모델이 작성한 부분 분석입니다.");
  lines.push("이 자료를 통합하여 본 Synthesis JSON 의 기존 필드를 더 깊이 채우세요.");
  lines.push("자료를 그대로 복사하지 말고, 본 분석가의 단일 시각으로 통합·재서술하세요.");
  lines.push("");
  if (g.textual?.korean_translation) {
    lines.push("### Angle 1 — 텍스트 정밀 분석 (영문→한국어 번역)");
    lines.push(g.textual.korean_translation);
    lines.push("");
  } else if (g.textual?.english_analysis) {
    lines.push("### Angle 1 — Textual close-reading (English; please translate intent into Korean fields)");
    lines.push(g.textual.english_analysis);
    lines.push("");
  }
  if (g.critical?.critical_readings && g.critical.critical_readings.length > 0) {
    lines.push("### Angle 2 — 비평 전통별 복수 해석");
    for (const r of g.critical.critical_readings) {
      lines.push(`- **${r.tradition}**: ${r.thesis_ko}`);
      if (r.key_evidence_ko) lines.push(`  - 근거: ${r.key_evidence_ko}`);
      if (r.tension_with_default)
        lines.push(`  - 표준 해석과의 긴장: ${r.tension_with_default}`);
    }
    lines.push("");
  }
  if (
    g.pedagogical?.cultural_pitfalls_ko ||
    g.pedagogical?.korean_literature_parallels_ko ||
    (g.pedagogical?.discussion_questions_ko?.length ?? 0) > 0
  ) {
    lines.push("### Angle 3 — 한국 독자 학습 관점");
    if (g.pedagogical.cultural_pitfalls_ko) {
      lines.push(`- 문화적 함정: ${g.pedagogical.cultural_pitfalls_ko}`);
    }
    if (g.pedagogical.korean_literature_parallels_ko) {
      lines.push(
        `- 한국 문학 비교: ${g.pedagogical.korean_literature_parallels_ko}`,
      );
    }
    if ((g.pedagogical.discussion_questions_ko?.length ?? 0) > 0) {
      lines.push(`- 토론 질문 (참고만, 직접 채택 X):`);
      for (const q of g.pedagogical.discussion_questions_ko) {
        lines.push(`  - ${q}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}
