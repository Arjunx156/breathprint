import { type Chunk, type LlmRequest, type Provider, ProviderError } from "./types";

type Line = {
  message?: { content?: string };
  done?: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
};

function body(model: string, req: LlmRequest, stream: boolean) {
  return JSON.stringify({
    model,
    stream,
    messages: [
      { role: "system", content: req.system },
      ...req.turns.map((t) => ({
        role: t.role === "model" ? "assistant" : "user",
        content: t.text,
      })),
    ],
    ...(req.schema ? { format: req.schema } : {}),
    options: { temperature: req.temperature, num_predict: req.maxTokens },
  });
}

function chunk(line: Line): Chunk {
  const text = line.message?.content ?? "";
  if (!line.done) return { text };
  return { text, usage: { input: line.prompt_eval_count ?? 0, output: line.eval_count ?? 0 } };
}

/** A local model through Ollama's chat API: free, offline and good for iterating on prompts. */
export function ollama(host: string): Provider {
  const call = async (model: string, req: LlmRequest, signal: AbortSignal, stream: boolean) => {
    const res = await fetch(new URL("/api/chat", host), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body(model, req, stream),
      signal,
    }).catch((err: unknown) => {
      throw new ProviderError(0, err instanceof Error ? err.name : "ollama unreachable");
    });
    if (!res.ok || !res.body) throw new ProviderError(res.status, `ollama ${res.status}`);
    return res;
  };

  return {
    name: "ollama",
    async generate(model, req, signal) {
      const res = await call(model, req, signal, false);
      const line = (await res.json()) as Line;
      if (line.error) throw new ProviderError(500, "ollama error");
      return chunk(line);
    },
    async *stream(model, req, signal) {
      const res = await call(model, req, signal, true);
      for await (const line of ndjson(res.body as ReadableStream<Uint8Array>)) {
        if (line.error) throw new ProviderError(500, "ollama error");
        yield chunk(line);
      }
    },
  };
}

/** One parsed object per line of a newline-delimited JSON stream. */
async function* ndjson(body: ReadableStream<Uint8Array>): AsyncGenerator<Line> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const raw of lines) if (raw.trim()) yield JSON.parse(raw) as Line;
  }
}
