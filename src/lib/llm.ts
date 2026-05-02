const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434/api/chat";
const MODEL = process.env.ANALYSIS_MODEL || "bjoernb/gemma4-26b-fast";
const NUM_CTX = parseInt(process.env.OLLAMA_CTX || "32768");

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
}

// v2 Phase A item 2: combine the per-call timeout with the caller's signal
// (e.g. ReadableStream cancel propagation) so either source aborts the fetch.
function combineSignals(external: AbortSignal | undefined): AbortSignal {
  const timeout = AbortSignal.timeout(300_000);
  return external ? AbortSignal.any([timeout, external]) : timeout;
}

// Non-streaming call via Ollama (used for Survey + Verify — JSON integrity)
export async function callLLM(
  prompt: string,
  maxTokens = 2000,
  signal?: AbortSignal,
): Promise<{ text: string; usage: LLMUsage }> {
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      think: false,
      options: {
        num_predict: maxTokens,
        num_ctx: NUM_CTX,
        temperature: 0.3,
      },
    }),
    signal: combineSignals(signal),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `LLM 호출 실패: HTTP ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 300)}` : ""}`,
    );
  }

  let data: { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number };
  try {
    data = await res.json();
  } catch (e) {
    throw new Error(
      `LLM 응답 JSON 파싱 실패: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const content = data.message?.content ?? "";
  return {
    text: content,
    usage: {
      promptTokens: data.prompt_eval_count ?? 0,
      completionTokens: data.eval_count ?? 0,
    },
  };
}

// Streaming call via Ollama (used for Chunk Analysis + Synthesis — real-time UI)
export async function* streamLLMChunks(
  prompt: string,
  maxTokens = 2000,
  signal?: AbortSignal,
): AsyncGenerator<string, LLMUsage> {
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: true,
      think: false,
      options: {
        num_predict: maxTokens,
        num_ctx: NUM_CTX,
        temperature: 0.3,
      },
    }),
    signal: combineSignals(signal),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `LLM 스트리밍 호출 실패: HTTP ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 300)}` : ""}`,
    );
  }

  if (!res.body) throw new Error("LLM 응답에 body가 없습니다.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let totalCompletion = 0;
  let totalPrompt = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const chunk = JSON.parse(line);
        const content = chunk.message?.content;
        if (content) {
          yield content;
        }
        if (chunk.done) {
          totalPrompt = chunk.prompt_eval_count ?? 0;
          totalCompletion = chunk.eval_count ?? 0;
        }
      } catch {
        // skip malformed
      }
    }
  }

  return { promptTokens: totalPrompt, completionTokens: totalCompletion };
}
