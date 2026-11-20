import { afterEach, describe, expect, test } from "bun:test";
import { PHOTO, restoreFetch, type Sent, serve, signal } from "./fetchStub";
import { ollama } from "./ollama";
import type { Chunk, ProviderError } from "./types";

afterEach(restoreFetch);

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
