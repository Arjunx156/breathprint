import { fixtureSource } from "./air/fixture";
import { createApp, type Deps } from "./app";
import { loadEnv } from "./env";
import { createLlm, type Llm, SILENT } from "./llm/llm";
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
