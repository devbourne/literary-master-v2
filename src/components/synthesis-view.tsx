"use client";

import type {
  Synthesis,
  AnnotatedQuote,
  CharacterReading,
  SymbolReading,
} from "@/lib/types";

interface Props {
  synthesis: Synthesis;
}

const style: { [k: string]: React.CSSProperties } = {
  wrapper: {
    maxWidth: 720,
    margin: "0 auto",
    fontFamily:
      "'Noto Serif KR', 'Crimson Pro', 'EB Garamond', Georgia, serif",
    color: "#1a1714",
  },
  thesis: {
    borderTop: "1px solid #3a3024",
    borderBottom: "1px solid #3a3024",
    padding: "20px 8px",
    margin: "24px 20px",
    fontStyle: "italic",
    fontSize: 18,
    lineHeight: 1.55,
    textAlign: "center",
    color: "#2a2219",
  },
  section: { marginBottom: 36 },
  partLabel: {
    fontSize: 10,
    letterSpacing: "0.35em",
    color: "#8b7355",
    textTransform: "uppercase",
    marginBottom: 8,
    fontFamily: "'Crimson Pro', serif",
  },
  subsection: {
    fontSize: 18,
    fontWeight: 700,
    margin: "24px 0 10px",
    color: "#1a1510",
  },
  num: {
    color: "#8b7355",
    fontSize: 15,
    marginRight: 10,
    letterSpacing: "0.1em",
    fontFamily: "'Crimson Pro', serif",
    fontWeight: 500,
  },
  minor: {
    fontSize: 14,
    fontWeight: 700,
    marginTop: 20,
    marginBottom: 6,
    color: "#2a2219",
  },
  lead: {
    fontSize: 15.5,
    lineHeight: 1.8,
    color: "#2a2219",
    marginBottom: 14,
  },
  body: {
    fontSize: 14.5,
    lineHeight: 1.85,
    marginBottom: 12,
    color: "#1a1714",
  },
  prose: {
    fontSize: 14.5,
    lineHeight: 1.85,
    textAlign: "justify",
    marginBottom: 12,
    color: "#1a1714",
  },
  quote: {
    borderLeft: "2px solid #8b7355",
    padding: "8px 0 8px 16px",
    margin: "12px 24px",
    fontSize: 13.5,
    lineHeight: 1.65,
  },
  quoteEn: {
    fontStyle: "italic",
    fontFamily: "'Crimson Pro', 'Noto Serif KR', serif",
    color: "#1a1510",
    marginBottom: 4,
  },
  quoteKo: { marginBottom: 4, color: "#2a2219" },
  quoteNote: { fontSize: 12.5, color: "#5c4f3f", fontStyle: "italic" },
  guideList: { listStyle: "none", padding: 0, counterReset: "rg" },
  guideItem: {
    padding: "10px 0 10px 36px",
    position: "relative" as const,
    fontSize: 14.5,
    lineHeight: 1.75,
    borderBottom: "1px dotted #bfae8f",
    counterIncrement: "rg",
  },
  guideBadge: {
    position: "absolute" as const,
    left: 0,
    top: 10,
    width: 22,
    height: 22,
    lineHeight: "22px",
    textAlign: "center" as const,
    background: "#2a2219",
    color: "#faf5e8",
    borderRadius: "50%",
    fontFamily: "'Crimson Pro', serif",
    fontSize: 12,
    fontWeight: 700,
  },
};

export function SynthesisView({ synthesis: s }: Props) {
  const hasContent =
    s.thesis_ko ||
    s.overview_essay_ko ||
    s.character_readings.length ||
    s.plot_reading_ko ||
    s.twist_reading?.thesis_ko ||
    s.symbolism_readings.length ||
    s.tone_flow_ko ||
    s.style_essay_ko ||
    s.reading_guide_ko.length;
  if (!hasContent) {
    return (
      <div style={{ ...style.body, color: "#6b7280", fontStyle: "italic" }}>
        종합 분석이 비어 있습니다.
      </div>
    );
  }

  return (
    <div style={style.wrapper}>
      <div style={style.partLabel}>Part Ⅲ · Critical Synthesis</div>

      {s.thesis_ko && <div style={style.thesis}>{s.thesis_ko}</div>}

      {s.overview_essay_ko && (
        <section style={style.section}>
          <h3 style={style.subsection}>
            <span style={style.num}>§1</span>작품 개요
          </h3>
          <p style={style.prose}>{s.overview_essay_ko}</p>
        </section>
      )}

      {s.character_readings.length > 0 && (
        <section style={style.section}>
          <h3 style={style.subsection}>
            <span style={style.num}>§2</span>인물 해석
          </h3>
          {s.character_readings.map((r, i) => (
            <CharacterBlock key={i} reading={r} />
          ))}
        </section>
      )}

      {s.plot_reading_ko && (
        <section style={style.section}>
          <h3 style={style.subsection}>
            <span style={style.num}>§3</span>플롯 해석
          </h3>
          <p style={style.prose}>{s.plot_reading_ko}</p>
        </section>
      )}

      {(s.twist_reading?.thesis_ko ||
        s.twist_reading?.irony_direction_ko ||
        s.twist_reading?.setup_moments.length ||
        s.twist_reading?.payoff_moments.length) && (
        <section style={style.section}>
          <h3 style={style.subsection}>
            <span style={style.num}>§4</span>반전과 아이러니
          </h3>
          {s.twist_reading.thesis_ko && (
            <p style={style.prose}>
              <strong>논지.</strong> {s.twist_reading.thesis_ko}
            </p>
          )}
          {s.twist_reading.irony_direction_ko && (
            <p style={style.prose}>
              <strong>아이러니의 방향.</strong> {s.twist_reading.irony_direction_ko}
            </p>
          )}
          {s.twist_reading.comparison_ko && (
            <p style={style.prose}>
              <strong>비교 구조.</strong> {s.twist_reading.comparison_ko}
            </p>
          )}
          {s.twist_reading.setup_moments.length > 0 && (
            <>
              <h4 style={style.minor}>복선 (Setup)</h4>
              {s.twist_reading.setup_moments.map((q, i) => (
                <QuoteBlock key={i} quote={q} />
              ))}
            </>
          )}
          {s.twist_reading.payoff_moments.length > 0 && (
            <>
              <h4 style={style.minor}>회수 (Payoff)</h4>
              {s.twist_reading.payoff_moments.map((q, i) => (
                <QuoteBlock key={i} quote={q} />
              ))}
            </>
          )}
        </section>
      )}

      {s.symbolism_readings.length > 0 && (
        <section style={style.section}>
          <h3 style={style.subsection}>
            <span style={style.num}>§5</span>상징 심화
          </h3>
          {s.symbolism_readings.map((r, i) => (
            <SymbolBlock key={i} reading={r} />
          ))}
        </section>
      )}

      {s.tone_flow_ko && (
        <section style={style.section}>
          <h3 style={style.subsection}>
            <span style={style.num}>§6</span>톤 흐름
          </h3>
          <p style={style.prose}>{s.tone_flow_ko}</p>
        </section>
      )}

      {s.style_essay_ko && (
        <section style={style.section}>
          <h3 style={style.subsection}>
            <span style={style.num}>§7</span>문체
          </h3>
          <p style={style.prose}>{s.style_essay_ko}</p>
        </section>
      )}

      {s.cultural_notes_ko && (
        <section style={style.section}>
          <h3 style={style.subsection}>
            <span style={style.num}>§8</span>문화 · 역사 배경
          </h3>
          <p style={style.prose}>{s.cultural_notes_ko}</p>
        </section>
      )}

      {s.reading_guide_ko.length > 0 && (
        <section style={style.section}>
          <h3 style={style.subsection}>
            <span style={style.num}>§9</span>한국 독자를 위한 읽기 가이드
          </h3>
          <ol style={style.guideList}>
            {s.reading_guide_ko.map((g, i) => (
              <li key={i} style={style.guideItem}>
                <span style={style.guideBadge}>{i + 1}</span>
                {g}
              </li>
            ))}
          </ol>
        </section>
      )}

      {s.closing_note_ko && (
        <section style={style.section}>
          <p style={{ ...style.prose, fontStyle: "italic", color: "#3a3024" }}>
            {s.closing_note_ko}
          </p>
        </section>
      )}
    </div>
  );
}

function CharacterBlock({ reading: r }: { reading: CharacterReading }) {
  if (!r.reading_ko && !r.name) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={style.minor}>{r.name}</h4>
      {r.reading_ko && <p style={style.prose}>{r.reading_ko}</p>}
      {r.key_quote && <QuoteBlock quote={r.key_quote} />}
    </div>
  );
}

function SymbolBlock({ reading: r }: { reading: SymbolReading }) {
  if (!r.reading_ko && !r.symbol) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={style.minor}>{r.symbol}</h4>
      {r.reading_ko && <p style={style.prose}>{r.reading_ko}</p>}
      {r.evidence && (r.evidence.en || r.evidence.ko) && (
        <div style={style.quote}>
          {r.evidence.en && (
            <div style={style.quoteEn}>&ldquo;{r.evidence.en}&rdquo;</div>
          )}
          {r.evidence.ko && <div style={style.quoteKo}>{r.evidence.ko}</div>}
        </div>
      )}
    </div>
  );
}

function QuoteBlock({ quote: q }: { quote: AnnotatedQuote }) {
  if (!q.en && !q.ko) return null;
  return (
    <div style={style.quote}>
      {q.en && <div style={style.quoteEn}>&ldquo;{q.en}&rdquo;</div>}
      {q.ko && <div style={style.quoteKo}>{q.ko}</div>}
      {q.note_ko && <div style={style.quoteNote}>{q.note_ko}</div>}
    </div>
  );
}
