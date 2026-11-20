import type { Hour, Window } from "./air";
import { THRESHOLDS } from "./factors";
import { hourOf, oneDecimal } from "./format";
import { isNonEmpty, lastOf, mean, type NonEmpty } from "./list";

/*
 * Clean windows and peaks: the stretches of a day worth opening a window
 * for, and the ones worth staying in through.
 */

/** Hours when people are awake to open a window, walk or play. */
const WAKING = { from: 6, to: 22 };
/** A day whose spread is under a quarter of its mean has no window worth naming. */
const FLAT_RATIO = 0.25;
/** Fewer waking hours than this and there is too little of the day to compare. */
const MIN_HOURS = 3;
/** Clean hours sit under 80% of the day's mean and in the lowest 35% of its range. */
const CLEAN_OF_MEAN = 0.8;
const CLEAN_OF_RANGE = 0.35;
/** Peak hours sit 20% above the day's mean. */
const PEAK_OF_MEAN = 1.2;

/** The PM2.5 readings in a run of hours, gaps left out. */
export const pm25Of = (hours: readonly { pm25: number | null }[]) =>
  hours.map((h) => h.pm25).filter((v): v is number => v !== null);

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

/** The hour after a YYYY-MM-DDTHH:00 time, across midnight and month ends. */
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

/** A run of hours as a window: where it starts and ends, and how clean it was. */
function toWindow(run: NonEmpty<Hour>, quality: Window["quality"]): Window {
  const [first] = run;
  const last = lastOf(run);
  const meanPm25 = oneDecimal(mean(pm25Of(run)));
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
  if (values.length < MIN_HOURS) return { windows: [], peaks: [], flat: true };
  const avg = mean(values);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (avg === 0 || (max - min) / avg < FLAT_RATIO) return { windows: [], peaks: [], flat: true };

  const cleanBelow = Math.min(avg * CLEAN_OF_MEAN, min + CLEAN_OF_RANGE * (max - min));
  const peakAbove = avg * PEAK_OF_MEAN;
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
