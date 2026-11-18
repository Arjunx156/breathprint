import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { loadEnv } from "../env";
import { fromSocket } from "../socket";
import { type ClientIp, fromHeader, ipHasher, memoryStore, rateLimit } from "./rateLimit";

/** An app limited to two requests a minute per visitor, by the address `ip` trusts. */
function limited(ip: ClientIp) {
  return new Hono()
    .use(rateLimit({ name: "t", perMinute: 2, ip, hash: (a) => a }))
    .get("/", (c) => c.text("ok"));
}

const statuses = async (app: Hono, headers: Record<string, string>[]) => {
  const out: number[] = [];
  for (const h of headers) out.push((await app.request("/", { headers: h })).status);
  return out;
};

describe("whose address counts", () => {
  test("only the header the platform writes; a forged forwarding header changes nothing", async () => {
    const app = limited(fromHeader("x-real-ip"));
    const forged = (n: number) => ({
      "x-real-ip": "203.0.113.9",
      "x-forwarded-for": `10.0.0.${n}`,
    });
    expect(await statuses(app, [forged(1), forged(2), forged(3)])).toEqual([200, 200, 429]);
    expect(await statuses(app, [{ "x-real-ip": "203.0.113.10" }])).toEqual([200]);
  });

  test("visitors with no known address share one window instead of dodging it", async () => {
    const app = limited(fromHeader("x-real-ip"));
    expect(await statuses(app, [{}, { "x-forwarded-for": "198.51.100.4" }, {}])).toEqual([
      200, 200, 429,
    ]);
  });

  test("on Bun, the socket's peer, whatever the headers claim", async () => {
    const app = limited(fromSocket);
    const peer = { requestIP: () => ({ address: "192.0.2.7", family: "IPv4", port: 5000 }) };
    const send = async (spoof: string) =>
      (await app.request("/", { headers: { "x-real-ip": spoof } }, peer)).status;
    expect([await send("1.1.1.1"), await send("2.2.2.2"), await send("3.3.3.3")]).toEqual([
      200, 200, 429,
    ]);
  });

  test("with no socket to ask, the address is unknown rather than guessed", async () => {
    const seen: (string | undefined)[] = [];
    const app = new Hono().get("/", (c) => {
      seen.push(fromSocket(c));
      return c.text("ok");
    });
    await app.request("/", { headers: { "x-real-ip": "203.0.113.9" } });
    expect(seen).toEqual([undefined]);
  });

  test("configuration refuses a header clients can write themselves", () => {
    expect(() => loadEnv({ TRUSTED_IP_HEADER: "X-Forwarded-For" })).toThrow(/TRUSTED_IP_HEADER/);
    expect(() => loadEnv({ TRUSTED_IP_HEADER: "x-real-ip; drop" })).toThrow(/TRUSTED_IP_HEADER/);
    expect(loadEnv({ TRUSTED_IP_HEADER: "fly-client-ip" }).TRUSTED_IP_HEADER).toBe("fly-client-ip");
    expect(loadEnv({}).TRUSTED_IP_HEADER).toBeUndefined();
  });
});

describe("rate limit internals", () => {
  test("hashes addresses with a salt that turns over daily", () => {
    let now = 0;
    const hash = ipHasher(() => now);
    const first = hash("203.0.113.9");
    expect(first).not.toContain("203");
    expect(hash("203.0.113.9")).toBe(first);
    now = 86_400_000;
    expect(hash("203.0.113.9")).not.toBe(first);
  });

  test("windows reset after a minute", () => {
    const store = memoryStore();
    store.hit("k", 60_000, 0);
    expect(store.hit("k", 60_000, 1).count).toBe(2);
    expect(store.hit("k", 60_000, 60_001).count).toBe(1);
  });

  test("memory stays bounded even when a flood keeps every window open", () => {
    const store = memoryStore(3);
    for (let i = 0; i < 100; i++) store.hit(`visitor-${i}`, 60_000, 0);
    // The newest windows survive, the oldest were dropped, so visitor-0 starts afresh.
    expect(store.hit("visitor-99", 60_000, 1).count).toBe(2);
    expect(store.hit("visitor-0", 60_000, 1).count).toBe(1);
  });
});
