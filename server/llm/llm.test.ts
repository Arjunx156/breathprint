import { describe, expect, test } from "bun:test";
import { loadEnv } from "../env";
import { DEFAULT_MODELS, llmFromEnv } from "./config";
import { scripted } from "./fake";
import { createLlm, SILENT } from "./llm";
import {
  type LlmRequest,
  LlmUnavailable,
  type LogLine,
  type Provider,
  ProviderError,
} from "./types";

const req: LlmRequest = {
  job: "test",
  system: "s",
  turns: [{ role: "user", text: "hi" }],
  maxTokens: 50,
  temperature: 0,
};

function harness(provider: Provider | null, models = ["a", "b"], timeoutMs = 1000) {
  const lines: LogLine[] = [];
  const llm = createLlm({
    provider,
    models,
    timeoutMs,
    log: (l) => lines.push(l),
    sleep: SILENT.sleep,
  });
  return { llm, lines };
}

/** Answers from `byModel`, counting calls per model. */
function perModel(byModel: Record<string, Array<string | Error>>) {
  const calls: string[] = [];
  const provider = scripted((_req, model) => {
    calls.push(model);
    const queue = byModel[model] ?? [];
    return queue.shift() ?? new ProviderError(500, "empty");
  });
  return { provider, calls };
}

const reason = async (p: Promise<unknown>) => {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  return err instanceof LlmUnavailable ? err.reason : String(err);
};

describe("the model chain", () => {
  test("answers from the first model and logs tokens without any text", async () => {
    const { provider } = perModel({ a: ["hello"] });
    const { llm, lines } = harness(provider);
    expect(await llm.generate(req)).toEqual({ text: "hello", model: "a" });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ llm: "test", model: "a", outcome: "ok", in: 0, out: 0 });
    expect(JSON.stringify(lines)).not.toContain("hello");
  });

  test("a 429 moves straight to the next model", async () => {
    const { provider, calls } = perModel({ a: [new ProviderError(429, "quota")], b: ["ok"] });
    const { llm } = harness(provider);
    expect((await llm.generate(req)).model).toBe("b");
    expect(calls).toEqual(["a", "b"]);
  });

  test("a server error is retried once on the same model", async () => {
    const { provider, calls } = perModel({ a: [new ProviderError(503, "busy"), "ok"] });
    const { llm } = harness(provider);
    expect((await llm.generate(req)).model).toBe("a");
    expect(calls).toEqual(["a", "a"]);
  });

  test("a refused key stops the chain", async () => {
    const { provider, calls } = perModel({ a: [new ProviderError(403, "key")], b: ["ok"] });
    const { llm } = harness(provider);
    expect(await reason(llm.generate(req))).toBe("refused");
    expect(calls).toEqual(["a"]);
  });

  test("a model that hangs times out and the next one answers", async () => {
    const hangsOnA: Provider = {
      name: "fake",
      generate: (model, _req, signal) =>
        model === "a"
          ? new Promise((_, reject) =>
              signal.addEventListener("abort", () => reject(signal.reason)),
            )
          : Promise.resolve({ text: "late but here" }),
      stream: () => {
        throw new Error("unused");
      },
    };
    const { llm, lines } = harness(hangsOnA, ["a", "b"], 20);
    expect(await llm.generate(req)).toEqual({ text: "late but here", model: "b" });
    expect(lines[0]).toMatchObject({ model: "a", outcome: "timeout" });
  });

  test("every model out of quota means unavailable, so the caller falls back", async () => {
    const { provider } = perModel({
      a: [new ProviderError(429, "q")],
      b: [new ProviderError(429, "q")],
    });
    const { llm } = harness(provider);
    expect(await reason(llm.generate(req))).toBe("quota");
  });

  test("no provider is offline and not ready", async () => {
    const { llm } = harness(null);
    expect(llm.ready).toBe(false);
    expect(await reason(llm.generate(req))).toBe("offline");
  });

  test("streams arrive in order, and a failure before the first words falls through", async () => {
    const { provider } = perModel({
      a: [new ProviderError(500, "x"), new ProviderError(500, "x")],
      b: ["one two three four five six seven eight nine ten"],
    });
    const { llm } = harness(provider);
    const { model, chunks } = await llm.stream(req);
    let text = "";
    for await (const c of chunks) text += c;
    expect(model).toBe("b");
    expect(text).toBe("one two three four five six seven eight nine ten");
  });
});

describe("configuration", () => {
  test("a key alone turns Gemini on with the default chain", () => {
    const env = loadEnv({ GEMINI_API_KEY: "x".repeat(39) });
    expect(env.LLM_PROVIDER).toBe("gemini");
    expect(llmFromEnv(env).ready).toBe(true);
    expect(DEFAULT_MODELS.gemini.length).toBeGreaterThan(1);
  });

  test("no key means the model routes are offline", () => {
    const env = loadEnv({});
    expect(env.LLM_PROVIDER).toBe("fake");
    expect(llmFromEnv(env).ready).toBe(false);
  });

  test("prices parse as two numbers and reject nonsense", () => {
    expect(loadEnv({ LLM_PRICE_PER_MTOK: "0.1,0.4" }).LLM_PRICE_PER_MTOK).toEqual([0.1, 0.4]);
    expect(() => loadEnv({ LLM_PRICE_PER_MTOK: "free" })).toThrow("LLM_PRICE_PER_MTOK");
  });
});
