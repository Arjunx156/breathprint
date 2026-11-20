import { z } from "zod/mini";
import { type AqiReading, aqi, healthLevel, type Level, nowcast } from "./aqi";
import { dayOf, hourOf, oneDecimal } from "./format";
import { itemAt, mean } from "./list";
import { SECOND_MS } from "./time";
import { pm25Of, windowsForDay } from "./windows";

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

/** Local wall-clock hour for an instant, in the YYYY-MM-DDTHH:00 form the snapshot uses. */
export function localHourOf(nowMs: number, utcOffsetSeconds: number): string {
  const local = new Date(nowMs + utcOffsetSeconds * SECOND_MS);
  return `${local.toISOString().slice(0, 13)}:00`;
}

function indexOfNow(hours: readonly Hour[], now: string): number {
  const exact = hours.findIndex((h) => h.time === now);
  if (exact !== -1) return exact;
  const before = hours.filter((h) => h.time < now).length - 1;
  return Math.max(0, before);
}

const pm10Of = (hours: readonly Hour[]) =>
  hours.map((h) => h.pm10).filter((v): v is number => v !== null);

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
      mean: oneDecimal(mean(todayValues)),
      min: oneDecimal(todayValues.length > 0 ? Math.min(...todayValues) : 0),
      max: oneDecimal(todayValues.length > 0 ? Math.max(...todayValues) : 0),
    },
    tomorrow:
      tomorrowValues.length >= 12
        ? { mean: oneDecimal(mean(tomorrowValues)), health: healthLevel(mean(tomorrowValues)) }
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

/** The hours the overnight figures cover, across midnight. */
const NIGHT = { from: 22, to: 6 };

/** Mean PM2.5 over the coming night, 22:00 to 06:00. */
export function overnightPm25(summary: AirSummary): number {
  const night = summary.series.filter((h) => {
    const hr = hourOf(h.time);
    return (hr >= NIGHT.from || hr < NIGHT.to) && h.pm25 !== null;
  });
  return night.length > 0 ? oneDecimal(mean(pm25Of(night))) : summary.today.mean;
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
