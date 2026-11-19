import { z } from "zod";
import { type Chunk, type LlmRequest, type Provider, ProviderError } from "./types";

/** One line of Ollama's chat reply; the last one carries the token counts. */
const LineSchema = z.object({
  message: z.object({ content: z.string().optional() }).optional(),
  done: z.boolean().optional(),
  prompt_eval_count: z.number().optional(),
  eval_count: z.number().optional(),
  error: z.string().optional(),
});
type Line = z.infer<typeof LineSchema>;

function payload(model: string, req: LlmRequest, stream: boolean) {
  return JSON.stringify({
    model,
    stream,
    messages: [
      { role: "system", content: req.system },
      ...req.turns.map((t) => ({
        role: t.role === "model" ? "assistant" : "user",
        content: t.text,
        ...(t.images?.length ? { images: t.images.map((i) => i.data) } : {}),
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
      body: payload(model, req, stream),
      signal,
    }).catch((err: unknown) => {
      throw new ProviderError(0, err instanceof Error ? err.name : "ollama unreachable");
    });
    if (!res.ok) throw new ProviderError(res.status, `ollama ${res.status}`);
    return res;
  };

  return {
    name: "ollama",
    async generate(model, req, signal) {
      const res = await call(model, req, signal, false);
      const line = LineSchema.parse(await res.json());
      if (line.error) throw new ProviderError(500, "ollama error");
      return chunk(line);
    },
    async *stream(model, req, signal) {
      for await (const line of ndjson(await call(model, req, signal, true))) {
        if (line.error) throw new ProviderError(500, "ollama error");
        yield chunk(line);
      }
    },
  };
}

/** One checked object per line of a newline-delimited JSON reply. */
async function* ndjson(res: Response): AsyncGenerator<Line> {
  if (!res.body) throw new ProviderError(502, "ollama sent no body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const raw of lines) if (raw.trim()) yield LineSchema.parse(JSON.parse(raw));
  }
}
