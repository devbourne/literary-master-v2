# literary-master v2 — workspace notes

This folder is the **active development copy** of literary-master, parallel to `/home/code/literary-master/` (v1 production).

## Why a separate folder

- `/home/code/literary-master/` stays as **v1 production** — stable, runnable, current code
- `/home/code/literary-master-v2/` is **v2 development** — implements `literary-master_v2.md` Phase A onward
- Both can run simultaneously; the dev workflow does not put v1 at risk

## Run side-by-side

| | v1 production | v2 development |
|---|---|---|
| Folder | `/home/code/literary-master/` | `/home/code/literary-master-v2/` |
| Dev port | 3000 (default) | **3001** |
| Storage dir | `data/teaching-materials/` | `data/teaching-materials/` (same path, but inside v2 folder — cwd-relative resolution) |
| Log dir | `/tmp/analysis_logs` | `/tmp/analysis_logs_v2` |
| Git history | shared with main repo | independent (initialized fresh in this folder) |

```bash
# Terminal 1 — v1 production
cd /home/code/literary-master && npm run dev      # → localhost:3000

# Terminal 2 — v2 development
cd /home/code/literary-master-v2 && npm run dev   # → localhost:3001
```

## Implementation roadmap (from `literary-master_v2.md`)

| Phase | Items | Status |
|---|---|---|
| **A. Core 완결성** | Finalization Gate, Cancel propagation, Coverage Repair Agent, Verify Agent v2, off-batch filter | 🚧 in progress (this folder) |
| B. 장문 안정성 | Profile Agent (length-based strategy), Synthesis chunking | pending |
| C. 품질 재배치 | Quality Agent (Revise reversal), safeParseLLM 일관화 | pending |
| D. UX/스캔 정리 | Segmentation Agent, server-side extract | pending |
| E. Productionization | Storage auth, multi-process | deferred (matches v1 Phase 3) |
| **F. Multi-model augmentation** | JSON Fallback (Qwen3), Adversarial Verify (gpt-oss:120b) | ✅ implemented; opt-in via env vars |

## Phase F env vars (multi-model augmentation)

Both default to **off** so v2 behavior is identical to single-model gemma4 unless explicitly enabled.

| Var | Effect | Recommended value |
|---|---|---|
| `FALLBACK_MODEL` | When the default model's output fails schema parse at a *structural integrity* point (Profile merge, Synthesis merge), retry the same prompt with this model. | `qwen3:30b-a3b-instruct-2507-q4_K_M` (JSON-robustness keeper from `model-test-on-dgx`) |
| `ADVERSARIAL_VERIFY_MODEL` | After Verify v2 ends `UNCERTAIN`, run one final cross-check pass with this model. If it returns `VERIFIED`, upgrade the result with a `Cross-validated by <model>` note. Other outcomes are recorded but don't change status. | `gpt-oss:120b` (DGX Spark only — 65 GB) |

## Model decisions (carried from v1)

Single `bjoernb/gemma4-26b-fast` for all stages — locked in by bilingual constraint (English source → Korean output). See [model-test-on-dgx/reports/2026-05-02_gptoss20_vs_gemma4_multiaxis.md](https://github.com/devbourne/model-test-on-dgx/blob/main/reports/2026-05-02_gptoss20_vs_gemma4_multiaxis.md) for the verification.

Phase F (post-D) is when alternative model routing gets considered, not before.
