import { describe, expect, test } from "bun:test";
import { loadEnv } from "./env";
import { productionApp } from "./main";
import { fromHeader } from "./middleware/rateLimit";

/** The real wiring with the fixture forecast and no key, so nothing here touches the network. */
const app = productionApp(loadEnv({ AIR_SOURCE: "fixture" }), fromHeader("x-real-ip"));
const from = (ip: string) => ({ headers: { "x-real-ip": ip } });

describe("production wiring", () => {
  test("answers health and serves the configured forecast source", async () => {
    expect((await app.request("/api/health", from("203.0.113.1"))).status).toBe(200);
    const res = await app.request("/api/air?lat=28.7&lon=77.1", from("203.0.113.1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ source: "fixture", lat: 28.7, lon: 77.1 });
  });

  test("counts visitors by the address the platform vouches for", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 61; i++) {
      statuses.push((await app.request("/api/health", from("203.0.113.2"))).status);
    }
    expect(statuses.filter((s) => s === 429)).toHaveLength(1);
    expect((await app.request("/api/health", from("203.0.113.3"))).status).toBe(200);
  });
});
