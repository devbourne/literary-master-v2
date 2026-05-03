import type { Synthesis } from "../schemas/synthesis";

export function synthesisToPlainText(s: Synthesis): string {
  const out: string[] = [];
  if (s.thesis_ko) out.push(`[논지] ${s.thesis_ko}`);
  if (s.overview_essay_ko) out.push(`[개요] ${s.overview_essay_ko}`);
  if (s.character_readings.length) {
    out.push("[인물]");
    for (const c of s.character_readings) {
      if (c.name || c.reading_ko) {
        out.push(`- ${c.name}: ${c.reading_ko}`);
      }
    }
  }
  if (s.plot_reading_ko) out.push(`[플롯] ${s.plot_reading_ko}`);
  if (s.twist_reading?.thesis_ko || s.twist_reading?.irony_direction_ko) {
    out.push(
      `[반전] ${s.twist_reading.thesis_ko} · 아이러니: ${s.twist_reading.irony_direction_ko}`,
    );
    if (s.twist_reading.comparison_ko) out.push(`비교: ${s.twist_reading.comparison_ko}`);
    for (const m of s.twist_reading.setup_moments) {
      out.push(`  복선: "${m.en}" / "${m.ko}" — ${m.note_ko}`);
    }
    for (const m of s.twist_reading.payoff_moments) {
      out.push(`  회수: "${m.en}" / "${m.ko}" — ${m.note_ko}`);
    }
  }
  if (s.symbolism_readings.length) {
    out.push("[상징]");
    for (const x of s.symbolism_readings) {
      out.push(`- ${x.symbol}: ${x.reading_ko}`);
    }
  }
  if (s.tone_flow_ko) out.push(`[톤] ${s.tone_flow_ko}`);
  if (s.style_essay_ko) out.push(`[문체] ${s.style_essay_ko}`);
  if (s.cultural_notes_ko) out.push(`[문화] ${s.cultural_notes_ko}`);
  if (s.reading_guide_ko.length) {
    out.push("[읽기 가이드]");
    s.reading_guide_ko.forEach((g, i) => out.push(`${i + 1}. ${g}`));
  }
  if (s.closing_note_ko) out.push(`[단평] ${s.closing_note_ko}`);

  // v2.5 Multi-perspective fields (only emit when populated to keep
  // legacy-only outputs identical for backwards compatibility).
  if (s.multi_perspective_synthesis_ko) {
    out.push(`[다관점 통합] ${s.multi_perspective_synthesis_ko}`);
  }
  if (s.complementary_insights?.length) {
    out.push("[보완적 통찰]");
    for (const ci of s.complementary_insights) {
      if (ci.angle_pair || ci.insight_ko) {
        out.push(`- ${ci.angle_pair}: ${ci.insight_ko}`);
      }
    }
  }
  if (s.unresolved_tensions?.length) {
    out.push("[미해결 긴장]");
    for (const t of s.unresolved_tensions) {
      if (t.description_ko) {
        out.push(`- ${t.description_ko}`);
        if (t.most_defensible_ko) out.push(`  가장 defensible: ${t.most_defensible_ko}`);
      }
    }
  }
  if (s.pedagogical_scaffolding) {
    const ps = s.pedagogical_scaffolding;
    if (ps.cultural_pitfalls_ko) out.push(`[교수 지원 — 문화 함정] ${ps.cultural_pitfalls_ko}`);
    if (ps.korean_literature_parallels_ko)
      out.push(`[교수 지원 — 한국 문학 비교] ${ps.korean_literature_parallels_ko}`);
    if (ps.discussion_questions_ko?.length) {
      out.push("[교수 지원 — 토론 질문]");
      ps.discussion_questions_ko.forEach((q, i) => out.push(`${i + 1}. ${q}`));
    }
  }
  return out.join("\n\n");
}
