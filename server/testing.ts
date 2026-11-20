import { fixtureSource } from "./air/fixture";
import { createApp, type Deps } from "./app";
import { loadEnv } from "./env";
import { inTurn, scriptedLlm } from "./llm/fake";
import { createLlm, type Llm, SILENT } from "./llm/llm";
import type { LlmRequest } from "./llm/types";
import { fromHeader } from "./middleware/rateLimit";

/** A model client with nothing configured: every call fails fast as offline. */
export const offlineLlm = (): Llm =>
  createLlm({ provider: null, models: [], timeoutMs: 1000, ...SILENT });

/**
 * The API on test doubles: the fixture forecast, no places, no model, and the
 * visitor's address read from x-real-ip as on Vercel. Tests swap in what they need.
 */
export function testApp(overrides: Partial<Deps> = {}) {
  return createApp({
    env: loadEnv({}),
    air: fixtureSource(),
    geocode: async () => [],
    llm: offlineLlm(),
    clientIp: fromHeader("x-real-ip"),
    ...overrides,
  });
}

/** An app whose model answers from `replies` in turn, recording every request it is sent. */
export function withModel(replies: Array<string | Error>, env = loadEnv({})) {
  const seen: LlmRequest[] = [];
  return { app: testApp({ env, llm: scriptedLlm(inTurn(replies, seen)) }), seen };
}

/** A same-origin JSON POST from one visitor, as the browser sends it. */
export const post = (
  app: ReturnType<typeof testApp>,
  path: string,
  body: unknown,
  ip = "198.51.100.1",
) =>
  app.request(path, {
    method: "POST",
    headers: { origin: "http://localhost", "content-type": "application/json", "x-real-ip": ip },
    body: JSON.stringify(body),
  });
