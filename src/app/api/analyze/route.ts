import { orchestrate } from "@/lib/pipeline/orchestrator";
import { createJob, buildJobSend, markJobError } from "@/lib/jobs/registry";

// v2.5+ S5: /api/analyze is now always async.
// Returns 202 Accepted with { jobId } immediately. The orchestration runs
// detached in the background; client polls /api/jobs/[id] for status and
// the saved storageId on completion.

export const maxDuration = 600;

const MAX_TEXT_CHARS = parseInt(
  process.env.ANALYZE_MAX_CHARS || "200000",
  10,
);
const MAX_CONCURRENT =
  parseInt(process.env.ANALYZE_MAX_CONCURRENT || "2", 10) || 2;

type Counter = { inflight: number };
const counter: Counter = ((globalThis as unknown as { __analyzeCounter?: Counter }).__analyzeCounter ??= {
  inflight: 0,
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "invalid json body", code: "bad_json" },
      { status: 400 },
    );
  }

  const { text, sources: rawSources } =
    (body as { text?: unknown; sources?: unknown }) ?? {};

  if (typeof text !== "string" || text.trim().length === 0) {
    return Response.json(
      { error: "텍스트가 필요합니다.", code: "empty_text" },
      { status: 400 },
    );
  }

  if (text.length > MAX_TEXT_CHARS) {
    return Response.json(
      {
        error: `텍스트가 너무 깁니다. 최대 ${MAX_TEXT_CHARS.toLocaleString()}자까지 지원합니다.`,
        code: "text_too_long",
        limit: MAX_TEXT_CHARS,
        received: text.length,
      },
      { status: 413 },
    );
  }

  const sources =
    rawSources && typeof rawSources === "object"
      ? (rawSources as {
          rawText?: string;
          sourceUrl?: string;
          sourceTitle?: string;
          pieceTitle?: string;
          pieceIndex?: number;
        })
      : undefined;

  if (counter.inflight >= MAX_CONCURRENT) {
    return Response.json(
      {
        error: `동시 분석 한도(${MAX_CONCURRENT})에 도달했습니다. 잠시 후 다시 시도하세요.`,
        code: "too_many_concurrent",
      },
      { status: 429, headers: { "Retry-After": "30" } },
    );
  }

  // Reserve a job + AbortSignal up front so the response can return
  // immediately with the id.
  const { jobId, signal } = createJob({
    text,
    sources: sources
      ? {
          sourceUrl: sources.sourceUrl,
          sourceTitle: sources.sourceTitle,
          pieceTitle: sources.pieceTitle,
        }
      : undefined,
  });
  const send = buildJobSend(jobId);

  counter.inflight++;

  // Detached background work — we deliberately do NOT await this Promise.
  // It runs to completion (or cancellation via /api/jobs/[id] DELETE) on
  // its own; failures are caught locally and recorded onto the job state.
  void (async () => {
    try {
      await orchestrate(text, send, sources, signal);
    } catch (e) {
      if (signal.aborted && (e as { name?: string })?.name === "AbortError") {
        // Cancelled via /api/jobs/[id] DELETE — registry already recorded.
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        markJobError(jobId, msg);
      }
    } finally {
      counter.inflight = Math.max(0, counter.inflight - 1);
    }
  })();

  return Response.json(
    { jobId, status: "running" },
    { status: 202 },
  );
}
