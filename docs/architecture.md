# literary-master v2.5 — Architecture Reference

**Audience:** future maintainers extending or debugging the pipeline.
**Scope:** what each stage does, why it exists, how stages connect, where to look first when something breaks.

This doc is companion to:
- [`literary-master_v2.md`](../literary-master_v2.md) — original v2 design rationale
- [`V2_NOTES.md`](../V2_NOTES.md) — workspace + Phase F env vars
- [model-test-on-dgx reports](https://github.com/devbourne/model-test-on-dgx) — empirical findings driving the design

---

## Pipeline overview

```
INPUT (English literary text, up to ANALYZE_MAX_CHARS)
  │
  ├── 1. Profile Agent           — work-level structure (Qwen3 / gemma4)
  │       Strategy router (single-shot < 30k / samples 30-80k / chunk-merge > 80k)
  │
  ├── 1.5. Glossary Agent        — proper-noun English→Korean canonical map
  │         Pin "Magi" → "마기" etc. so block-level calls don't drift.
  │
  ├── 2. Block Batches           — per-block translation + annotation
  │       Batch size 5, parallel-2 dispatch, per-batch retry on parse fail,
  │       off-batch blockId filter, glossary section in every prompt.
  │
  ├── 2.5. Coverage Repair Agent — fills missing/empty blocks
  │         Single-block prompt with prev/next context + glossary, max 1 retry.
  │
  ├── 3. Quality Agent           — Pass 3 revise (ratio-banded)
  │       <30 % flagged → revise all; 30-80 % → revise all + warning; >80 % → batch retry first.
  │
  ├── 3.5. Multi-Gloss Agent     — 3 parallel angle glosses (v2.5)
  │         Textual close-reading (gpt-oss:120b → gemma4 translation)
  │         Critical / theoretical (qwen3:30b)
  │         Korean reader pedagogical (gemma4)
  │         Triggered when text ≥ 1500 chars and MULTI_GLOSS != "false".
  │
  ├── 4. Synthesis Agent         — split into two stages
  │       4a. Core Synthesis     — 12 existing fields, single-shot or chunk-merge.
  │       4b. Multi-Perspective Enrichment — 4 new fields, focused small-schema call.
  │
  ├── 4.5. Korean Proofreader    — character-level glitch fix on synthesis fields
  │         Triggers on synthesis prose ≥ 800 chars OR enrichment prose ≥ 200 chars,
  │         plus block-level walk when PROOFREAD_BLOCKS=true.
  │
  └── 5. Verify Agent v2         — agentic verification with CORRECTION-apply loop
          UNCERTAIN → context expand. CORRECTION → apply suggested_fix to synthesis,
          re-verify. Adversarial cross-check when ADVERSARIAL_VERIFY_MODEL set and
          status is UNCERTAIN.

  ↓
Finalization Gate
  complete | complete_with_warnings | incomplete
  Persists teaching material; emits SSE event for the UI.
```

---

## Why each stage exists (debugging-time motivation)

| Stage | Solves | Where to look when it breaks |
|---|---|---|
| Glossary | Per-batch model drifts on proper-noun spelling (마기 → 마귀 in different blocks) | `src/lib/agents/glossary-agent.ts`, `prompts/glossary.ts` |
| Off-batch filter | LLM hallucinates other batch's blockIds when primed by rolling summary | `orchestrator.ts` `expectedIds` set |
| Per-batch retry | Single-batch parse failure used to drop 5 blocks; one extra LLM call recovers most | `orchestrator.ts` `retryRes` block |
| Coverage Repair | Some blocks return empty even after retry; fills them with single-block context | `agents/coverage-repair-agent.ts` |
| Multi-Gloss layer (v2.5) | gemma4 alone produces surface-level analysis; Combo-D-style multi-perspective adds depth | `agents/multi-gloss-agent.ts`, `prompts/gloss-{textual,critical,pedagogical,textual-translate}.ts` |
| Synthesis split (v2.5) | Cramming 16 fields in one call produced unreliable JSON in 4/5 trials; two focused calls are 100 % reliable across 4 trials | `agents/synthesis-agent.ts` `runEnrichment` |
| Synthesis key normalizer | gemma4 occasionally emits canonical key with character glitches (`multi_perspective_seynthesis_ko`, `s무_synthesis_ko`); fuzzy matcher migrates value to canonical name | `schemas/synthesis-key-normalize.ts` |
| Phase G (synthesis prompt + verify Step C) | Both gemma4 and gpt-oss family hallucinate canonical-text endings even when input doesn't contain them | `prompts/synthesis.ts` `사전 지식 사용 금지` section, `prompts/verify.ts` Step C |
| Korean Proofreader | gemma4 Q4 glitches Korean syllables in long output (`20나기` for `20세기`) | `agents/korean-proofreader-agent.ts` |
| Verify v2 | v1 verify only judged; v2 actually applies fixes and re-verifies (max 3 iter) | `agents/verify-agent.ts` |
| Cancel propagation | Client navigation away used to leave Ollama running for 30+ min | `app/api/analyze/route.ts` `cancelController`, `lib/llm.ts` `combineSignals` |
| Finalization Gate | v1 lacked explicit `incomplete` state; partial output got persisted as success | `pipeline/finalization-gate.ts` |
| Multi-Gloss + Synthesis Split + Phase 3 widened gate | All three required to surface multi-perspective depth reliably with character integrity | `orchestrator.ts` Stage 3.5 / 4 / 4.5 sections |

---

## Schema reference

### `Synthesis` (12 + 4 fields)

```ts
// 12 core fields (Stage 4a output)
thesis_ko, overview_essay_ko, character_readings[],
plot_reading_ko, twist_reading{thesis_ko, irony_direction_ko, comparison_ko, setup_moments[], payoff_moments[]},
symbolism_readings[], tone_flow_ko, style_essay_ko, cultural_notes_ko, reading_guide_ko[], closing_note_ko

// 4 multi-perspective fields (Stage 4b output, v2.5)
multi_perspective_synthesis_ko        — single 400-700 char meta-essay integrating 3 angles
complementary_insights[]              — { angle_pair, insight_ko }
unresolved_tensions[]                 — { description_ko, most_defensible_ko }
pedagogical_scaffolding{}             — { cultural_pitfalls_ko, korean_literature_parallels_ko, discussion_questions_ko[] }
```

All schemas use `.passthrough()` and `.default("")/[]/{}` for backwards compatibility — saved files predating v2.5 schema additions still parse with the new fields filled by defaults.

### `AnnotatedBlock`

Block contents from Pass 2:
```
blockId, originalText,
literary_translation, literal_translation, korean_commentary,
annotations { containsForeshadowing, containsCallback, toneShift, sceneTransition, symbolismPresent, literaryDevices, culturalReferences, key_vocabulary, ... },
revised_literary_translation?, revised_literal_translation?, revision_reason?,    // Quality Agent (Pass 3)
partial?, repair_reason?                                                          // Coverage Repair Agent (Pass 2.5)
```

---

## Environment variables — what changes pipeline behavior

See [`.env.production.example`](../.env.production.example) for the full list with defaults and rationale. Quick reference:

| Var | Effect |
|---|---|
| `ANALYSIS_MODEL` | default model for every stage. `bjoernb/gemma4-26b-fast` locked in by bilingual constraint. |
| `FALLBACK_MODEL` | F-1: structural-integrity LLM calls (Profile merge, Synthesis merge, Stage 4b enrichment) retry with this when default's parse fails. |
| `ADVERSARIAL_VERIFY_MODEL` | F-2: cross-check pass when Verify v2 ends UNCERTAIN. |
| `BLOCK_BATCH_MODEL` | per-stage model routing for Pass 2 only. gpt-oss family disqualified for Korean blocks. |
| `MULTI_GLOSS_TEXTUAL_MODEL` / `MULTI_GLOSS_CRITICAL_MODEL` | per-angle override for Multi-Gloss layer. |
| `BATCH_PARALLELISM` | 2 = sweet spot, 3+ slower due to GPU memory bandwidth contention on DGX Spark. |
| `MULTI_GLOSS` | "false" disables Stage 3.5 + Stage 4b. Default on. |
| `PROOFREAD_BLOCKS` | "true" walks every block's Korean fields through Phase 3. Adds ~5 min on 159 blocks. |
| `OLLAMA_CTX` | num_ctx for Ollama calls; 32K covers chapter-length input. |
| `TEACHING_MATERIAL_DIR` | persistence directory; default `./data/teaching-materials/`. |
| `TEACHING_MATERIAL_LIST_ENABLED` | enables `/api/teaching-material` listing (single-user setups). |
| `ANALYZE_MAX_CHARS` / `ANALYZE_MAX_CONCURRENT` | input caps and concurrency throttling. |

---

## Known operational characteristics

- **Wall-clock budget**: 20–30 min per analysis is the production target inherited from v1. v2.5 fits typical chapter inputs (3–5 KB). 12 KB+ inputs cross the budget — see [production budget findings report](https://github.com/devbourne/model-test-on-dgx/blob/main/reports/2026-05-02_production_budget_findings.md).
- **Memory profile**: gemma4 17 GB + qwen3 18 GB + gpt-oss:120b 65 GB ≈ 100 GB resident during Stage 02 + 3.5 parallel work. DGX Spark 128 GB headroom is comfortable; lower-memory hosts should disable Multi-Gloss or override BLOCK_BATCH_MODEL.
- **gemma4 character glitches in Korean long-form**: documented in [`2026-05-02_korean_long_form_failure_modes.md`](https://github.com/devbourne/model-test-on-dgx/blob/main/reports/2026-05-02_korean_long_form_failure_modes.md). Mitigation: Glossary pre-pin + Korean Proofreader post-pass + key normalizer for JSON-key glitches.
- **Verify v2 divergence on big-model output**: gpt-oss:120b critique can produce more issues each iteration; max-iter cap (2 in production, 3 in dev) bounds the loop and emits `complete_with_warnings` when it can't converge.

---

## Stage-by-stage source map

| Stage | Files |
|---|---|
| Profile | `agents/profile-agent.ts`, `prompts/profile.ts`, `prompts/profile-partial.ts`, `prompts/profile-merge.ts` |
| Glossary | `agents/glossary-agent.ts`, `prompts/glossary.ts`, `schemas/glossary.ts` |
| Block batches | `pipeline/orchestrator.ts` Pass 2 loop, `prompts/block-batch.ts`, `pipeline/batcher.ts`, `pipeline/blocker.ts` |
| Coverage Repair | `agents/coverage-repair-agent.ts`, `prompts/block-single.ts` |
| Quality (Pass 3) | `agents/quality-agent.ts`, `prompts/pass3-revise.ts`, `schemas/revise.ts` |
| Multi-Gloss | `agents/multi-gloss-agent.ts`, `prompts/gloss-{textual,critical,pedagogical,textual-translate}.ts`, `schemas/gloss.ts` |
| Synthesis 4a | `agents/synthesis-agent.ts` `runSingleShot` / `runChunkMerge`, `prompts/synthesis.ts`, `prompts/synthesis-partial.ts`, `prompts/synthesis-merge.ts` |
| Synthesis 4b | `agents/synthesis-agent.ts` `runEnrichment`, `prompts/synthesis-multi-perspective.ts`, `schemas/synthesis-enrichment.ts`, `schemas/synthesis-key-normalize.ts` |
| Korean Proofreader | `agents/korean-proofreader-agent.ts`, `prompts/korean-proofread.ts` |
| Verify v2 | `agents/verify-agent.ts`, `prompts/verify.ts`, `prompts/synthesis-fix.ts` |
| Finalization Gate | `pipeline/finalization-gate.ts` |
| Pipeline orchestration | `pipeline/orchestrator.ts` |
| LLM calls + cancel | `lib/llm.ts`, `lib/llm-fallback.ts` |
| API + streaming | `app/api/analyze/route.ts`, `app/api/{scan,extract,teaching-material}/route.ts` |
| UI | `components/analysis-page.tsx`, `components/synthesis-view.tsx`, `components/report-viewer.tsx`, `components/saved-detail.tsx` |

---

## Common debugging entry points

- **Analysis hung at a stage** → tail `/tmp/analysis_logs_v2/*.txt`. Each stage writes a per-call log.
- **Output JSON missing fields** → `synthesis_strategy.txt` shows parseOk per stage; `synthesis_raw.txt` captures the model's actual output for the single-shot path. `synthesis_key_migrations.txt` shows fuzzy-key recoveries when they happen.
- **Korean Proofreader didn't fire** → check `korean_proofread_skipped.txt` for the gate values; threshold is `synthesisProseLen >= 800 OR enrichmentProseLen >= 200`.
- **Coverage Repair couldn't recover blocks** → blocks marked `partial: true` with `repair_reason`. Final state will be `complete_with_warnings` listing them.
- **Verify keeps producing CORRECTION** → look at `verify_agent_result.txt` for the issues list. v2 cap is 2 iterations; dev cap is 3. Often means the model can't fix what it found (e.g. requested fact not in source — Phase G hallucination guard catches this class).
