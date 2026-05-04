// v1 vs v2.5 quality regression suite — runner.
//
// Submits each text in bench/texts/ to both v1 (SSE on :3000) and v2.5
// (async polling on :3001). Captures the resulting TeachingMaterial JSON
// from each version's storage layer into bench/results/{v1,v2.5}/.
//
// Usage: tsx bench/run-bench.ts [--only=text-id,…] [--skip-v1] [--skip-v2.5]

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, resolve } from "path";

interface CorpusEntry {
  id: string;
  file: string;
  title: string;
  author: string;
  size_class: string;
  notes: string;
}

interface RunResult {
  textId: string;
  version: "v1" | "v2.5";
  ok: boolean;
  storageId?: string;
  elapsedSec: number;
  events?: number;
  error?: string;
}

const ROOT = resolve(__dirname);
const V1_BASE = process.env.V1_BASE || "http://localhost:3000";
const V25_BASE = process.env.V25_BASE || "http://localhost:3001";
const V1_DATA = process.env.V1_DATA || "/home/code/literary-master/data/teaching-materials";
const V25_DATA = process.env.V25_DATA || "/home/code/literary-master-v2/data/teaching-materials";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function loadCorpus(): CorpusEntry[] {
  const raw = readFileSync(join(ROOT, "texts", "corpus.json"), "utf8");
  const parsed = JSON.parse(raw) as { texts: CorpusEntry[] };
  return parsed.texts;
}

function loadText(file: string): string {
  return readFileSync(join(ROOT, "texts", file), "utf8");
}

async function runV1(text: string, title: string): Promise<RunResult> {
  const t0 = Date.now();
  let events = 0;
  let storageId: string | undefined;
  let lastError: string | undefined;
  try {
    const res = await fetch(`${V1_BASE}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        sources: { sourceTitle: title, pieceTitle: title },
      }),
    });
    if (!res.ok || !res.body) {
      return {
        textId: title,
        version: "v1",
        ok: false,
        elapsedSec: (Date.now() - t0) / 1000,
        error: `HTTP ${res.status}`,
      };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n\n")) !== -1) {
        const chunk = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 2);
        if (!chunk.startsWith("data:")) continue;
        const json = chunk.slice(5).trim();
        if (!json) continue;
        try {
          const evt = JSON.parse(json) as {
            type: string;
            storageId?: string;
            warnings?: string[];
            message?: string;
            reason?: string;
          };
          events++;
          if (evt.type === "complete" || evt.type === "complete_with_warnings") {
            storageId = evt.storageId;
          } else if (evt.type === "error") {
            lastError = evt.message ?? "unknown error";
          } else if (evt.type === "incomplete") {
            lastError = `incomplete: ${evt.reason ?? "unknown"}`;
          }
        } catch {
          // tolerate parse errors
        }
      }
    }
  } catch (e) {
    return {
      textId: title,
      version: "v1",
      ok: false,
      elapsedSec: (Date.now() - t0) / 1000,
      error: e instanceof Error ? e.message : String(e),
    };
  }
  return {
    textId: title,
    version: "v1",
    ok: !!storageId,
    storageId,
    events,
    elapsedSec: (Date.now() - t0) / 1000,
    error: storageId ? undefined : (lastError ?? "no storageId"),
  };
}

async function runV25(text: string, title: string): Promise<RunResult> {
  const t0 = Date.now();
  try {
    const submit = await fetch(`${V25_BASE}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        sources: { sourceTitle: title, pieceTitle: title },
      }),
    });
    if (!submit.ok) {
      const body = (await submit.json().catch(() => ({}))) as { error?: string };
      return {
        textId: title,
        version: "v2.5",
        ok: false,
        elapsedSec: (Date.now() - t0) / 1000,
        error: body.error ?? `HTTP ${submit.status}`,
      };
    }
    const { jobId } = (await submit.json()) as { jobId: string };
    while (true) {
      await sleep(5000);
      const r = await fetch(`${V25_BASE}/api/jobs/${jobId}`);
      if (!r.ok) continue;
      const { job } = (await r.json()) as {
        job: {
          status: string;
          storageId?: string;
          error?: string;
          reason?: string;
        };
      };
      if (
        job.status === "complete" ||
        job.status === "complete_with_warnings"
      ) {
        return {
          textId: title,
          version: "v2.5",
          ok: !!job.storageId,
          storageId: job.storageId,
          elapsedSec: (Date.now() - t0) / 1000,
        };
      }
      if (job.status === "error") {
        return {
          textId: title,
          version: "v2.5",
          ok: false,
          elapsedSec: (Date.now() - t0) / 1000,
          error: job.error ?? "error",
        };
      }
      if (job.status === "incomplete") {
        return {
          textId: title,
          version: "v2.5",
          ok: false,
          elapsedSec: (Date.now() - t0) / 1000,
          error: `incomplete: ${job.reason ?? "unknown"}`,
        };
      }
      if (job.status === "cancelled") {
        return {
          textId: title,
          version: "v2.5",
          ok: false,
          elapsedSec: (Date.now() - t0) / 1000,
          error: "cancelled",
        };
      }
    }
  } catch (e) {
    return {
      textId: title,
      version: "v2.5",
      ok: false,
      elapsedSec: (Date.now() - t0) / 1000,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function captureResult(
  version: "v1" | "v2.5",
  textId: string,
  storageId: string,
): boolean {
  const dir = version === "v1" ? V1_DATA : V25_DATA;
  const src = join(dir, `${storageId}.json`);
  if (!existsSync(src)) return false;
  const dest = join(ROOT, "results", version, `${textId}.json`);
  mkdirSync(join(ROOT, "results", version), { recursive: true });
  const raw = readFileSync(src, "utf8");
  writeFileSync(dest, raw, "utf8");
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const onlyFlag = args.find((a) => a.startsWith("--only="));
  const onlyIds = onlyFlag ? onlyFlag.slice(7).split(",") : null;
  const skipV1 = args.includes("--skip-v1");
  const skipV25 = args.includes("--skip-v2.5");

  const corpus = loadCorpus();
  const filtered = onlyIds
    ? corpus.filter((c) => onlyIds.includes(c.id))
    : corpus;

  console.log(`Bench corpus: ${filtered.length} text(s)`);
  filtered.forEach((c) => {
    const len = loadText(c.file).length;
    console.log(`  ${c.id} — ${c.title} by ${c.author} (${len} chars)`);
  });

  const results: RunResult[] = [];
  for (const c of filtered) {
    const text = loadText(c.file);
    if (!skipV1) {
      console.log(`\n[v1] running ${c.id}…`);
      const r = await runV1(text, c.title);
      console.log(
        `  → ${r.ok ? "OK" : "FAIL"} | ${r.elapsedSec.toFixed(1)}s | ` +
          (r.storageId ?? r.error),
      );
      if (r.ok && r.storageId) {
        const captured = captureResult("v1", c.id, r.storageId);
        if (!captured) console.warn(`  warn: storage file not found`);
      }
      results.push(r);
    }
    if (!skipV25) {
      console.log(`\n[v2.5] running ${c.id}…`);
      const r = await runV25(text, c.title);
      console.log(
        `  → ${r.ok ? "OK" : "FAIL"} | ${r.elapsedSec.toFixed(1)}s | ` +
          (r.storageId ?? r.error),
      );
      if (r.ok && r.storageId) {
        const captured = captureResult("v2.5", c.id, r.storageId);
        if (!captured) console.warn(`  warn: storage file not found`);
      }
      results.push(r);
    }
  }

  const runlogPath = join(ROOT, "results", `runlog-${Date.now()}.json`);
  writeFileSync(runlogPath, JSON.stringify(results, null, 2), "utf8");
  console.log(`\nRun log: ${runlogPath}`);
  console.log(`Results captured under ${join(ROOT, "results")}`);
}

void main();
