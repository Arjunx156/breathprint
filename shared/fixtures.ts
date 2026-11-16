import type { AirSnapshot, Hour } from "./air";

/**
 * A Delhi winter day's PM2.5 shape relative to its base level: high through the
 * night and the morning rush while the inversion holds, lowest in the early
 * afternoon when the mixing layer is deepest, climbing again after sunset.
 */
const DELHI_WINTER_SHAPE = [
  1.15, 1.18, 1.15, 1.1, 1.05, 1.05, 1.1, 1.18, 1.2, 1.1, 0.95, 0.8, 0.68, 0.58, 0.52, 0.55, 0.65,
  0.8, 0.95, 1.05, 1.12, 1.18, 1.2, 1.18,
] as const;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Four days of a severe Delhi winter spell: the day before `day`, so the
 * 24-hour India AQI has a past to average, then `day` and two days ahead,
 * each slightly worse or better than the last.
 */
export function delhiSevereSnapshot(
  day: string,
  base = 285,
  dayTrend = [0.96, 1, 1.04, 0.92],
): AirSnapshot {
  const start = new Date(new Date(`${day}T00:00:00Z`).getTime() - 86_400_000);
  const hours: Hour[] = [];
  for (let i = 0; i < 24 * dayTrend.length; i++) {
    const t = new Date(start.getTime() + i * 3_600_000);
    const shape = DELHI_WINTER_SHAPE[i % 24] as number;
    const trend = dayTrend[Math.floor(i / 24)] ?? 1;
    const pm25 = Math.round(base * shape * trend * 10) / 10;
    hours.push({
      time: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:00`,
      pm25,
      pm10: Math.round(pm25 * 1.55),
      no2: Math.round(60 + 40 * shape),
      o3: Math.round(20 + 40 * (1.2 - shape)),
    });
  }
  return {
    lat: 28.7,
    lon: 77.1,
    timezone: "Asia/Kolkata",
    utcOffsetSeconds: 19_800,
    fetchedAt: `${day}T02:30:00.000Z`,
    source: "fixture",
    hours,
  };
}

/** 08:00 in Delhi on the fixture day, as epoch milliseconds. */
export function delhiMorning(day: string): number {
  return new Date(`${day}T08:00:00+05:30`).getTime();
}

export const DEMO_DAY = "2026-11-18";
