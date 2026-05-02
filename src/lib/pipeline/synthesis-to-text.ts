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
  return out.join("\n\n");
}
