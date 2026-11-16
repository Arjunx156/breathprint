import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { aqi, healthLevel, levelOnScale, nowcast, subIndex } from "./aqi";

describe("subIndex on the US scale", () => {
  test.each([
    [0, 0],
    [9.0, 50],
    [9.1, 51],
    [35.4, 100],
    [35.5, 101],
    [55.4, 150],
    [125.4, 200],
    [225.4, 300],
    [225.5, 301],
    [325.4, 500],
  ])("PM2.5 %p reads %p", (c, expected) => {
    expect(subIndex("US", "pm25", c)).toBe(expected);
  });

  test("truncates to one decimal before lookup", () => {
    expect(subIndex("US", "pm25", 9.09)).toBe(50);
  });

  test("caps above the scale at 500", () => {
    expect(subIndex("US", "pm25", 900)).toBe(500);
  });

  test("PM10 bands", () => {
    expect(subIndex("US", "pm10", 154)).toBe(100);
    expect(subIndex("US", "pm10", 425)).toBe(301);
  });
});

describe("subIndex on India's NAQI", () => {
  test.each([
    [30, 50],
    [31, 51],
    [60, 100],
    [90, 200],
    [120, 300],
    [250, 400],
    [251, 401],
    [380, 500],
  ])("PM2.5 %p reads %p", (c, expected) => {
    expect(subIndex("IN", "pm25", c)).toBe(expected);
  });

  test("CPCB worked example: 45 ug/m3 is 75", () => {
    expect(subIndex("IN", "pm25", 45)).toBe(75);
  });

  test("a Delhi severe morning at 300 ug/m3 reads 439", () => {
    // 401 + (500 - 401) / (380 - 251) * (300 - 251) = 438.6
    expect(subIndex("IN", "pm25", 300)).toBe(439);
  });
});

describe("aqi", () => {
  test("reports the worse pollutant", () => {
    const r = aqi("IN", 40, 400);
    expect(r.dominant).toBe("pm10");
    expect(r.category).toBe("veryPoor");
  });

  test("names categories on each scale", () => {
    expect(aqi("IN", 300, null).category).toBe("severe");
    expect(aqi("US", 300, null).category).toBe("hazardous");
    expect(aqi("US", 40, null).category).toBe("usg");
  });

  test("India's wide bands map to the right level", () => {
    expect(levelOnScale("IN", 150)).toBe(2);
    expect(levelOnScale("IN", 201)).toBe(3);
    expect(levelOnScale("IN", 401)).toBe(5);
  });
});

describe("healthLevel", () => {
  test("uses the US bands regardless of display", () => {
    expect(healthLevel(8)).toBe(0);
    expect(healthLevel(40)).toBe(2);
    expect(healthLevel(300)).toBe(5);
  });
});

describe("nowcast", () => {
  test("steady air returns the steady value", () => {
    expect(nowcast(Array(12).fill(80))).toBe(80);
  });

  test("leans on the newest hours when air changes fast", () => {
    const rising = [200, 150, 100, 80, 60, 50, 50, 50, 50, 50, 50, 50];
    const value = nowcast(rising) ?? 0;
    const mean = rising.reduce((a, b) => a + b, 0) / rising.length;
    expect(value).toBeGreaterThan(mean);
    expect(value).toBeLessThan(200);
  });

  test("needs two of the three latest hours", () => {
    expect(nowcast([null, null, 50, 50])).toBeNull();
    expect(nowcast([50, null, 50])).toBe(50);
  });
});

describe("properties", () => {
  test("sub-index never decreases as concentration rises", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("US" as const, "IN" as const),
        fc.double({ min: 0, max: 600, noNaN: true }),
        fc.double({ min: 0, max: 50, noNaN: true }),
        (scale, c, delta) => subIndex(scale, "pm25", c + delta) >= subIndex(scale, "pm25", c),
      ),
    );
  });

  test("nowcast stays within the observed range", () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: 900, noNaN: true }), { minLength: 3, maxLength: 12 }),
        (xs) => {
          const v = nowcast(xs) ?? 0;
          return v >= Math.min(...xs) - 0.1 && v <= Math.max(...xs) + 0.1;
        },
      ),
    );
  });
});
