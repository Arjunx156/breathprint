import { describe, expect, test } from "bun:test";
import { AirSnapshotSchema } from "@shared/air";
import { fixtureSource } from "./air/fixture";
import { type AirSource, UpstreamError } from "./air/source";
import { JSON_LIMIT } from "./app";
import { loadEnv } from "./env";
import type { Geocoder } from "./geocode";
import { CONTENT_SECURITY_POLICY } from "./headers";
import { testApp } from "./testing";

const env = loadEnv({ RATE_LIMIT_PER_MIN: "5" });
const places: Geocoder = async (q) => [
  { name: `${q}, Delhi, India`, lat: 28.7, lon: 77.1, country: "IN" },
];
const app = (air: AirSource = fixtureSource(), geocode = places) => testApp({ env, air, geocode });
const get = (path: string, a = app(), headers: Record<string, string> = {}) =>
  a.request(path, { headers: { "x-real-ip": crypto.randomUUID(), ...headers } });

describe("health", () => {
  test("answers with the provider and air source, and security headers", async () => {
    const res = await get("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", provider: "fake", ai: false, air: "fixture" });
    expect(res.headers.get("content-security-policy")).toBe(CONTENT_SECURITY_POLICY);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });
});

describe("air", () => {
  test("returns a valid snapshot the CDN may cache", async () => {
    const res = await get("/api/air?lat=28.7&lon=77.1");
    expect(res.status).toBe(200);
    expect(AirSnapshotSchema.safeParse(await res.json()).success).toBe(true);
    expect(res.headers.get("cache-control")).toContain("s-maxage=1800");
  });

  test("redirects precise coordinates to their grid cell", async () => {
    const res = await get("/api/air?lat=28.7041&lon=77.1025");
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("/api/air?lat=28.7&lon=77.1");
  });

  test("rejects coordinates off the planet with a clear envelope", async () => {
    const res = await get("/api/air?lat=91&lon=0");
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toContain("lat");
    expect(body.error.requestId).toBe(res.headers.get("x-request-id") ?? "");
  });

  test("says the data service is down without leaking why", async () => {
    const down: AirSource = {
      name: "open-meteo",
      snapshot: async () => {
        throw new UpstreamError("open-meteo", "status 503");
      },
    };
    const res = await get("/api/air?lat=28.7&lon=77.1", app(down));
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).toContain("upstream_unavailable");
    expect(text).not.toContain("503");
  });
});

describe("geocode", () => {
  test("finds places and caches them for a day", async () => {
    const res = await get("/api/geocode?q=Rohini");
    expect(res.status).toBe(200);
    expect(((await res.json()) as { places: unknown[] }).places).toHaveLength(1);
    expect(res.headers.get("cache-control")).toContain("s-maxage=86400");
  });

  test("needs at least two characters", async () => {
    expect((await get("/api/geocode?q=R")).status).toBe(400);
  });
});

describe("guards", () => {
  const post = (a: ReturnType<typeof app>, init: RequestInit) =>
    a.request("/api/health", { method: "POST", ...init });

  test("refuses writes from other sites", async () => {
    const res = await post(app(), {
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(403);
  });

  test("accepts its own pages when TLS ends before the server", async () => {
    // Vercel hands the function an http:// URL while the browser's Origin says https://.
    const res = await app().request("http://breathprint.example/api/health", {
      method: "POST",
      headers: { origin: "https://breathprint.example", "content-type": "application/json" },
      body: "{}",
    });
    expect(res.status).not.toBe(403);
  });

  test("refuses a lookalike host and an opaque origin", async () => {
    for (const origin of ["https://breathprint.example.evil.example", "null"]) {
      const res = await app().request("http://breathprint.example/api/health", {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: "{}",
      });
      expect(res.status).toBe(403);
    }
  });

  test("refuses bodies over the limit", async () => {
    const res = await post(app(), {
      headers: { origin: "http://localhost", "content-type": "application/json" },
      body: JSON.stringify({ pad: "x".repeat(JSON_LIMIT) }),
    });
    expect(res.status).toBe(413);
  });

  test("limits each visitor per minute and says when to come back", async () => {
    const a = app();
    const visitor = { "x-real-ip": "203.0.113.9" };
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await get("/api/health", a, visitor)).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    const blocked = await get("/api/health", a, visitor);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect((await get("/api/health", a, { "x-real-ip": "203.0.113.10" })).status).toBe(200);
  });

  test("unknown paths get the same error envelope", async () => {
    const res = await get("/api/nothing");
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: "not_found" } });
  });
});
