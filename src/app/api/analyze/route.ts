import { orchestrate } from "@/lib/pipeline/orchestrator";
import type { PipelineEvent } from "@/lib/types";

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

  counter.inflight++;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: PipelineEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Stream closed
        }
      };

      try {
        await orchestrate(text, send, sources);
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        counter.inflight = Math.max(0, counter.inflight - 1);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
