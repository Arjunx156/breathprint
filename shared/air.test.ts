import { describe, expect, test } from "bun:test";
import {
  type Hour,
  inWindow,
  localHourOf,
  overnightPm25,
  pm25At,
  summarize,
  windowsForDay,
} from "./air";
import { DEMO_DAY, delhiMorning, delhiSevereSnapshot } from "./fixtures";

const hour = (h: number, pm25: number | null): Hour => ({
  time: `2026-11-18T${String(h).padStart(2, "0")}:00`,
  pm25,
  pm10: null,
  no2: null,
  o3: null,
});

describe("localHourOf", () => {
  test("shifts UTC to local wall-clock time", () => {
    const ms = Date.UTC(2026, 10, 18, 2, 45);
    expect(localHourOf(ms, 19_800)).toBe("2026-11-18T08:00");
  });

  test("crosses midnight", () => {
    const ms = Date.UTC(2026, 10, 17, 20, 0);
    expect(localHourOf(ms, 19_800)).toBe("2026-11-18T01:00");
  });
});

describe("windowsForDay", () => {
  test("finds the afternoon dip on a Delhi winter day", () => {
    const snap = delhiSevereSnapshot(DEMO_DAY);
    const day = snap.hours.filter((h) => h.time.startsWith(DEMO_DAY));
    const { windows, peaks, flat } = windowsForDay(day);
    expect(flat).toBe(false);
    expect(windows).toHaveLength(1);
    expect(windows[0]?.start).toBe("2026-11-18T12:00");
    expect(windows[0]?.end).toBe("2026-11-18T17:00");
    expect(windows[0]?.quality).toBe("better");
    expect(peaks[0]?.meanPm25).toBeGreaterThan(windows[0]?.meanPm25 ?? 0);
  });

  test("calls a flat day flat instead of inventing a window", () => {
    const day = Array.from({ length: 24 }, (_, h) => hour(h, 200 + (h % 2)));
    expect(windowsForDay(day)).toEqual({ windows: [], peaks: [], flat: true });
  });

  test("labels a window clean when it drops under the moderate ceiling", () => {
    const day = Array.from({ length: 24 }, (_, h) => hour(h, h >= 13 && h < 16 ? 20 : 90));
    const [w] = windowsForDay(day).windows;
    expect(w?.quality).toBe("clean");
    expect(w?.hours).toBe(3);
  });

  test("skips missing readings", () => {
    const day = Array.from({ length: 24 }, (_, h) => hour(h, h % 3 === 0 ? null : 100));
    expect(windowsForDay(day).flat).toBe(true);
  });

  test("ignores night hours when looking for a window", () => {
    const pm = (h: number) => (h < 5 ? 10 : h >= 13 && h < 15 ? 60 : 120);
    const day = Array.from({ length: 24 }, (_, h) => hour(h, pm(h)));
    const [w] = windowsForDay(day).windows;
    expect(w?.start).toBe("2026-11-18T13:00");
  });
});

describe("summarize", () => {
  const snap = delhiSevereSnapshot(DEMO_DAY);
  const summary = summarize(snap, delhiMorning(DEMO_DAY));

  test("reads the current hour in local time", () => {
    expect(summary.now).toBe("2026-11-18T08:00");
  });

  test("reports a severe morning on both scales", () => {
    expect(summary.current.aqi.IN.category).toBe("severe");
    expect(summary.current.aqi.US.category).toBe("hazardous");
    expect(summary.current.health).toBe(5);
  });

  test("looks 48 hours ahead and finds today's window first", () => {
    expect(summary.series).toHaveLength(48);
    expect(summary.windows[0]?.start).toBe("2026-11-18T12:00");
    expect(summary.tomorrow?.mean).toBeGreaterThan(summary.today.mean);
  });

  test("answers questions about specific clock times", () => {
    expect(pm25At(summary, "14:00")).toBeLessThan(pm25At(summary, "08:00"));
    expect(inWindow(summary, "14:30")?.start).toBe("2026-11-18T12:00");
    expect(inWindow(summary, "09:00")).toBeNull();
    expect(overnightPm25(summary)).toBeGreaterThan(summary.windows[0]?.meanPm25 ?? 0);
  });

  test("falls back to the nearest earlier hour when the forecast is stale", () => {
    const later = summarize(snap, delhiMorning(DEMO_DAY) + 30 * 60_000);
    expect(later.now).toBe("2026-11-18T08:00");
  });
});
