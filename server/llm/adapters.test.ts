import { afterEach, describe, expect, test } from "bun:test";
import { gemini } from "./gemini";
import { ollama } from "./ollama";
import { type Chunk, type LlmRequest, ProviderError } from "./types";

const real = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = real;
});

type Sent = { url: string; body: Record<string, unknown> };

/** Answers every request with `reply` and keeps what was sent. */
function serve(respond: () => Response): Sent[] {
  const sent: Sent[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    const raw = input instanceof Request ? await input.text() : String(init?.body ?? "{}");
    sent.push({ url, body: JSON.parse(raw) });
    return respond();
  }) as typeof fetch;
  return sent;
}

const PHOTO: LlmRequest = {
  job: "scan",
  system: "List what you can see.",
  turns: [
    {
      role: "user",
      text: "List what you can see.",
      images: [{ mime: "image/jpeg", data: "AAAA" }],
    },
  ],
  schema: { type: "object" },
  maxTokens: 600,
  temperature: 0.2,
};

const { schema: _schema, ...TEXT } = PHOTO;

const signal = () => new AbortController().signal;

function sse(...events: unknown[]): Response {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  return new Response(body, { headers: { "content-type": "text/event-stream" } });
}

const reply = (text: string, usage?: Record<string, number>) => ({
  candidates: [{ content: { role: "model", parts: [{ text }] }, index: 0 }],
  ...(usage ? { usageMetadata: usage } : {}),
});

describe("gemini", () => {
  test("sends the photo before the words, with the schema and system prompt", async () => {
    const sent = serve(() =>
      Response.json(
        reply('{"room":"kitchen"}', {
          promptTokenCount: 1500,
          candidatesTokenCount: 20,
          thoughtsTokenCount: 5,
        }),
      ),
    );
    const out = await gemini("test-key").generate("gemini-test", PHOTO, signal());
    expect(out).toEqual({ text: '{"room":"kitchen"}', usage: { input: 1500, output: 25 } });

    const { url, body } = sent[0] as Sent;
    expect(url).toContain("models/gemini-test:generateContent");
    expect(body.contents).toEqual([
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: "AAAA" } },
          { text: "List what you can see." },
        ],
      },
    ]);
    expect(JSON.stringify(body)).toContain("List what you can see.");
    expect(JSON.stringify(body)).toContain('"responseMimeType":"application/json"');
  });

  test("streams text as it arrives", async () => {
    serve(() => sse(reply("Keep the "), reply("windows shut.")));
    const parts: string[] = [];
    for await (const c of gemini("k").stream("m", TEXT, signal())) {
      parts.push(c.text);
    }
    expect(parts.join("")).toBe("Keep the windows shut.");
  });

  test("a rate limit comes back as a 429 the chain can act on", async () => {
    serve(() =>
      Response.json(
        { error: { code: 429, message: "quota", status: "RESOURCE_EXHAUSTED" } },
        {
          status: 429,
        },
      ),
    );
    const err = await gemini("k")
      .generate("m", PHOTO, signal())
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).status).toBe(429);
  });
});

describe("ollama", () => {
  test("passes photos as base64 and asks for the schema", async () => {
    const sent = serve(() =>
      Response.json({
        message: { content: "{}" },
        done: true,
        prompt_eval_count: 9,
        eval_count: 4,
      }),
    );
    const out = await ollama("http://localhost:11434").generate("llava", PHOTO, signal());
    expect(out).toEqual({ text: "{}", usage: { input: 9, output: 4 } });
    const { url, body } = sent[0] as Sent;
    expect(url).toBe("http://localhost:11434/api/chat");
    expect(body.format).toEqual({ type: "object" });
    expect(body.messages).toEqual([
      { role: "system", content: "List what you can see." },
      { role: "user", content: "List what you can see.", images: ["AAAA"] },
    ]);
  });

  test("reads a stream split mid-line", async () => {
    const text = `${JSON.stringify({ message: { content: "Mask " } })}\n${JSON.stringify({
      message: { content: "on." },
      done: true,
      prompt_eval_count: 3,
      eval_count: 2,
    })}\n`;
    const cut = Math.floor(text.length / 3);
    const encoder = new TextEncoder();
    serve(
      () =>
        new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(encoder.encode(text.slice(0, cut)));
              c.enqueue(encoder.encode(text.slice(cut)));
              c.close();
            },
          }),
        ),
    );
    const chunks: Chunk[] = [];
    for await (const c of ollama("http://localhost:11434").stream("m", PHOTO, signal())) {
      chunks.push(c);
    }
    expect(chunks.map((c) => c.text).join("")).toBe("Mask on.");
    expect(chunks.at(-1)?.usage).toEqual({ input: 3, output: 2 });
  });

  test("an unreachable server and a model error are provider errors", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const down = await ollama("http://localhost:11434")
      .generate("m", PHOTO, signal())
      .catch((e: unknown) => e);
    expect((down as ProviderError).status).toBe(0);

    serve(() => Response.json({ error: "model not found" }));
    const bad = await ollama("http://localhost:11434")
      .generate("m", PHOTO, signal())
      .catch((e: unknown) => e);
    expect((bad as ProviderError).status).toBe(500);

    serve(() => new Response("nope", { status: 404 }));
    const missing = await ollama("http://localhost:11434")
      .generate("m", PHOTO, signal())
      .catch((e: unknown) => e);
    expect((missing as ProviderError).status).toBe(404);
  });
});
