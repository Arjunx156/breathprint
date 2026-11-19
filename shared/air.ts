import { z } from "zod/mini";
import { type AqiReading, aqi, healthLevel, type Level, nowcast } from "./aqi";
import { THRESHOLDS } from "./factors";
import { isNonEmpty, itemAt, lastOf, type NonEmpty } from "./list";

const localHour = z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:00$/));
const reading = z.nullable(z.number().check(z.gte(0), z.lte(5000)));

export const HourSchema = z.object({
  time: localHour,
  pm25: reading,
  pm10: reading,
  no2: reading,
  o3: reading,
});

export const AirSnapshotSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  timezone: z.string().check(z.maxLength(64)),
  utcOffsetSeconds: z.int(),
  fetchedAt: z.iso.datetime(),
  source: z.enum(["open-meteo", "fixture"]),
  hours: z.array(HourSchema).check(z.minLength(1), z.maxLength(24 * 10)),
});

export type Hour = z.infer<typeof HourSchema>;
export type AirSnapshot = z.infer<typeof AirSnapshotSchema>;

/** A stretch of hours, start inclusive and end exclusive, in local time. */
export type Window = {
  start: string;
  end: string;
  hours: number;
  meanPm25: number;
  /** "clean" means at or under the US "Moderate" ceiling; "better" is only relatively clean. */
  quality: "clean" | "better" | "peak";
};

export type AirSummary = {
  source: AirSnapshot["source"];
  fetchedAt: string;
  timezone: string;
  /** Local time of the current hour, YYYY-MM-DDTHH:00. */
  now: string;
  current: {
    pm25: number;
    pm10: number | null;
    no2: number | null;
    health: Level;
    aqi: { IN: AqiReading; US: AqiReading };
  };
  today: { mean: number; min: number; max: number };
  tomorrow: { mean: number; health: Level } | null;
  windows: Window[];
  peaks: Window[];
  /** True when today has no hour clearly better than the rest. */
  flat: boolean;
  /** The next 48 hours of PM2.5 for the forecast ribbon. */
  series: { time: string; pm25: number | null }[];
};

/** Hours when people are awake to open a window, walk or play. */
const WAKING = { from: 6, to: 22 };
/** A day whose spread is under a quarter of its mean has no window worth naming. */
const FLAT_RATIO = 0.25;

const round1 = (x: number) => Math.round(x * 10) / 10;

function mean(xs: readonly number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Local wall-clock hour for an instant, in the YYYY-MM-DDTHH:00 form the snapshot uses. */
export function localHourOf(nowMs: number, utcOffsetSeconds: number): string {
  const local = new Date(nowMs + utcOffsetSeconds * 1000);
  return `${local.toISOString().slice(0, 13)}:00`;
}

/** The hour of day, 0 to 23, from a YYYY-MM-DDTHH:MM time. */
export const hourOf = (time: string) => Number(time.slice(11, 13));
/** The YYYY-MM-DD date from a YYYY-MM-DDTHH:MM time. */
export const dayOf = (time: string) => time.slice(0, 10);

function indexOfNow(hours: readonly Hour[], now: string): number {
  const exact = hours.findIndex((h) => h.time === now);
  if (exact !== -1) return exact;
  const before = hours.filter((h) => h.time < now).length - 1;
  return Math.max(0, before);
}

const pm25Of = (hours: readonly { pm25: number | null }[]) =>
  hours.map((h) => h.pm25).filter((v): v is number => v !== null);
const pm10Of = (hours: readonly Hour[]) =>
  hours.map((h) => h.pm10).filter((v): v is number => v !== null);

/** Unbroken stretches of hours that pass `keep`. */
function runs(hours: readonly Hour[], keep: (h: Hour) => boolean): NonEmpty<Hour>[] {
  const out: NonEmpty<Hour>[] = [];
  let current: Hour[] = [];
  for (const h of hours) {
    if (keep(h)) {
      current.push(h);
    } else if (isNonEmpty(current)) {
      out.push(current);
      current = [];
    }
  }
  if (isNonEmpty(current)) out.push(current);
  return out;
}

function nextHour(time: string): string {
  const d = new Date(`${time}:00Z`);
  d.setUTCHours(d.getUTCHours() + 1);
  return `${d.toISOString().slice(0, 13)}:00`;
}

/** A cleaner run is "clean" only when it is safe for the most sensitive; otherwise just "better". */
function resolveQuality(quality: Window["quality"], meanPm25: number): Window["quality"] {
  if (quality === "peak") return "peak";
  return meanPm25 <= THRESHOLDS.sensitiveCaution ? "clean" : "better";
}

function toWindow(run: NonEmpty<Hour>, quality: Window["quality"]): Window {
  const [first] = run;
  const last = lastOf(run);
  const meanPm25 = round1(mean(pm25Of(run)));
  const resolved = resolveQuality(quality, meanPm25);
  return {
    start: first.time,
    end: nextHour(last.time),
    hours: run.length,
    meanPm25,
    quality: resolved,
  };
}

type DayWindows = { windows: Window[]; peaks: Window[]; flat: boolean };

/**
 * Finds the cleanest and dirtiest stretches of one day's waking hours.
 * Clean means under both 80% of the day's mean and the lowest third of its
 * range; peaks sit 20% above the mean. Only the best window and the worst
 * peak per day are kept, so the plan has one clear instruction.
 */
export function windowsForDay(hours: readonly Hour[]): DayWindows {
  const waking = hours.filter(
    (h) => hourOf(h.time) >= WAKING.from && hourOf(h.time) < WAKING.to && h.pm25 !== null,
  );
  const values = pm25Of(waking);
  if (values.length < 3) return { windows: [], peaks: [], flat: true };
  const avg = mean(values);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (avg === 0 || (max - min) / avg < FLAT_RATIO) return { windows: [], peaks: [], flat: true };

  const cleanBelow = Math.min(avg * 0.8, min + 0.35 * (max - min));
  const peakAbove = avg * 1.2;
  const best = runs(waking, (h) => (h.pm25 ?? Infinity) <= cleanBelow)
    .map((r) => toWindow(r, "better"))
    .sort((a, b) => a.meanPm25 - b.meanPm25 || b.hours - a.hours)
    .slice(0, 1);
  const worst = runs(waking, (h) => (h.pm25 ?? 0) >= peakAbove)
    .map((r) => toWindow(r, "peak"))
    .sort((a, b) => b.meanPm25 - a.meanPm25)
    .slice(0, 1);
  return { windows: best, peaks: worst, flat: false };
}

function groupByDay(hours: readonly Hour[]): Hour[][] {
  const days = new Map<string, Hour[]>();
  for (const h of hours) {
    const key = dayOf(h.time);
    days.set(key, [...(days.get(key) ?? []), h]);
  }
  return [...days.values()];
}

/** CPCB reports a 24-hour average; the US AQI uses NowCast for the current hour. */
function currentReading(hours: readonly Hour[], index: number) {
  const past = hours.slice(Math.max(0, index - 23), index + 1);
  const newestFirst = [...past].reverse();
  const here = itemAt(hours, index);
  const fine = nowcast(newestFirst.map((h) => h.pm25)) ?? here.pm25 ?? 0;
  const coarse = nowcast(newestFirst.map((h) => h.pm10)) ?? here.pm10;
  const fine24 = mean(pm25Of(past));
  const coarse24 = pm10Of(past);
  return {
    pm25: fine,
    pm10: coarse,
    no2: here.no2,
    health: healthLevel(fine),
    aqi: {
      IN: aqi("IN", fine24, coarse24.length > 0 ? mean(coarse24) : null),
      US: aqi("US", fine, coarse),
    },
  };
}

/** Everything the plan and the interface need from one forecast, at one instant. */
export function summarize(snapshot: AirSnapshot, nowMs: number): AirSummary {
  const now = localHourOf(nowMs, snapshot.utcOffsetSeconds);
  const index = indexOfNow(snapshot.hours, now);
  const ahead = snapshot.hours.slice(index, index + 48);
  const todayKey = dayOf(itemAt(snapshot.hours, index).time);
  const todayAll = snapshot.hours.filter((h) => dayOf(h.time) === todayKey);
  const todayValues = pm25Of(todayAll);
  const tomorrowHours = snapshot.hours.filter((h) => dayOf(h.time) > todayKey).slice(0, 24);
  const tomorrowValues = pm25Of(tomorrowHours);

  const perDay = groupByDay(ahead).map(windowsForDay);
  const todayWindows = perDay[0] ?? { windows: [], peaks: [], flat: true };

  return {
    source: snapshot.source,
    fetchedAt: snapshot.fetchedAt,
    timezone: snapshot.timezone,
    now,
    current: currentReading(snapshot.hours, index),
    today: {
      mean: round1(mean(todayValues)),
      min: round1(todayValues.length > 0 ? Math.min(...todayValues) : 0),
      max: round1(todayValues.length > 0 ? Math.max(...todayValues) : 0),
    },
    tomorrow:
      tomorrowValues.length >= 12
        ? { mean: round1(mean(tomorrowValues)), health: healthLevel(mean(tomorrowValues)) }
        : null,
    windows: perDay.flatMap((d) => d.windows),
    peaks: perDay.flatMap((d) => d.peaks),
    flat: todayWindows.flat,
    series: ahead.map((h) => ({ time: h.time, pm25: h.pm25 })),
  };
}

/** PM2.5 forecast for the next time the clock reads HH:MM, or the day's mean if unknown. */
export function pm25At(summary: AirSummary, clock: string): number {
  const hour = Number(clock.slice(0, 2));
  const hit = summary.series.find((h) => hourOf(h.time) === hour && h.pm25 !== null);
  return hit?.pm25 ?? summary.today.mean;
}

/** Mean PM2.5 over the coming night, 22:00 to 06:00. */
export function overnightPm25(summary: AirSummary): number {
  const night = summary.series.filter((h) => {
    const hr = hourOf(h.time);
    return (hr >= 22 || hr < 6) && h.pm25 !== null;
  });
  return night.length > 0 ? round1(mean(pm25Of(night))) : summary.today.mean;
}

/** Whether a clock time falls inside one of the clean windows. */
export function inWindow(summary: AirSummary, clock: string): Window | null {
  const hour = Number(clock.slice(0, 2));
  return (
    summary.windows.find((w) => {
      const from = hourOf(w.start);
      const to = from + w.hours;
      return hour >= from && hour < to;
    }) ?? null
  );
}

/** The HH:MM clock time from a YYYY-MM-DDTHH:MM time. */
export const clockOf = (time: string) => time.slice(11, 16);
