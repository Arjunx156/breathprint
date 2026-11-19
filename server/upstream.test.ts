import { describe, expect, test } from "bun:test";
import { openMeteo } from "./air/openMeteo";
import { cached, UpstreamError } from "./air/source";
import { TtlCache } from "./cache";
import { loadEnv } from "./env";
import { openMeteoGeocoder } from "./geocode";

const json = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

const OPEN_METEO = {
  timezone: "Asia/Kolkata",
  utc_offset_seconds: 19_800,
  hourly: {
    time: ["2026-11-18T00:00", "2026-11-18T01:00"],
    pm2_5: [301.24, null],
    pm10: [455.9, -3],
    nitrogen_dioxide: [80, 81],
    ozone: [12, 9000],
  },
};

describe("open-meteo adapter", () => {
  test("maps hours, rounds to 0.1 and drops impossible values", async () => {
    const snap = await openMeteo(json(OPEN_METEO)).snapshot(28.7, 77.1);
    expect(snap.source).toBe("open-meteo");
    expect(snap.hours[0]).toEqual({
      time: "2026-11-18T00:00",
      pm25: 301.2,
      pm10: 455.9,
      no2: 80,
      o3: 12,
    });
    expect(snap.hours[1]).toMatchObject({ pm25: null, pm10: null, o3: null });
  });

  test("asks for one past day and three ahead, at grid precision", async () => {
    let asked = "";
    const spy = (async (url: URL) => {
      asked = url.toString();
      return new Response(JSON.stringify(OPEN_METEO));
    }) as unknown as typeof fetch;
    await openMeteo(spy).snapshot(28.7, 77.1);
    expect(asked).toContain("latitude=28.7&longitude=77.1");
    expect(asked).toContain("past_days=1&forecast_days=3");
  });

  test("turns failures into upstream errors", async () => {
    expect(openMeteo(json({}, 503)).snapshot(0, 0)).rejects.toBeInstanceOf(UpstreamError);
    expect(openMeteo(json({ nope: true })).snapshot(0, 0)).rejects.toBeInstanceOf(UpstreamError);
  });
});

describe("geocoder", () => {
  test("names places in full and rounds them to the grid", async () => {
    const geocode = openMeteoGeocoder(
      json({
        results: [
          {
            name: "Rohini",
            latitude: 28.7383,
            longitude: 77.0822,
            country_code: "in",
            admin1: "Delhi",
            country: "India",
          },
        ],
      }),
    );
    expect(await geocode("Rohini", "en")).toEqual([
      { name: "Rohini, Delhi, India", lat: 28.7, lon: 77.1, country: "IN" },
    ]);
  });

  test("an empty search is an empty list", async () => {
    expect(await openMeteoGeocoder(json({}))("zzzz", "en")).toEqual([]);
  });
});

describe("cache", () => {
  test("shares one load between concurrent callers and expires", async () => {
    let t = 0;
    let loads = 0;
    const cache = new TtlCache<number>(1000, 10, () => t);
    const load = async () => ++loads;
    expect(await Promise.all([cache.getOrLoad("a", load), cache.getOrLoad("a", load)])).toEqual([
      1, 1,
    ]);
    t = 1001;
    expect(await cache.getOrLoad("a", load)).toBe(2);
  });

  test("drops the oldest entry when full", () => {
    const cache = new TtlCache<number>(1000, 2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(2);
  });

  test("a cached air source fetches each cell once", async () => {
    let calls = 0;
    const source = cached({
      name: "fixture",
      snapshot: async (lat, lon) => {
        calls++;
        return {
          lat,
          lon,
          timezone: "UTC",
          utcOffsetSeconds: 0,
          fetchedAt: new Date().toISOString(),
          source: "fixture",
          hours: [],
        };
      },
    });
    await source.snapshot(28.7, 77.1);
    await source.snapshot(28.7, 77.1);
    await source.snapshot(19.1, 72.9);
    expect(calls).toBe(2);
  });
});

describe("env", () => {
  test("defaults to the fake model and treats empty keys as unset", () => {
    const env = loadEnv({ GEMINI_API_KEY: "", LLM_MODELS: "a, b" });
    expect(env.LLM_PROVIDER).toBe("fake");
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.LLM_MODELS).toEqual(["a", "b"]);
  });

  test("names the bad variable and never echoes a value", () => {
    expect(() => loadEnv({ LLM_PROVIDER: "openai" })).toThrow(/LLM_PROVIDER/);
    expect(() => loadEnv({ GEMINI_API_KEY: "short-secret" })).not.toThrow(/short-secret/);
  });
});
