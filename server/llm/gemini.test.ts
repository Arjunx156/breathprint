import { afterEach, describe, expect, test } from "bun:test";
import { PHOTO, restoreFetch, type Sent, serve, signal, TEXT } from "../test/fetchStub";
import { gemini } from "./gemini";
import { ProviderError } from "./types";

afterEach(restoreFetch);

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
