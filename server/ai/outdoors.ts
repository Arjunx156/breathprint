import { exertionCeiling } from "@shared/actions/activity";
import type { Context } from "@shared/actions/types";
import { healthLevel } from "@shared/aqi";
import { clock, dayOf } from "@shared/format";
import { isSensitive } from "@shared/profile";
import { DAY_MS } from "@shared/time";

/** The forecast runs past midnight, so a window's hours alone don't say which day it is. */
export function dayName(time: string, now: string): string {
  const days = (Date.parse(dayOf(time)) - Date.parse(dayOf(now))) / DAY_MS;
  return ["today", "tomorrow"][days] ?? dayOf(time);
}

type Members = Context["profile"]["members"];
type Hours = { from: string; to: string };

/** The engine's call on exercise outside for one group: go now, wait for a window, or stay in. */
export type Outdoors =
  | { kind: "now" }
  | { kind: "wait"; hours: Hours }
  | { kind: "indoors"; tomorrow: Hours | null };

function callFor(air: Context["air"], people: Members): Outdoors {
  const ok = (pm25: number) => healthLevel(pm25) <= exertionCeiling(people);
  if (ok(air.current.pm25)) return { kind: "now" };
  const on = (day: string): Hours | null => {
    const found = air.windows.find(
      (win) => dayName(win.start, air.now) === day && ok(win.meanPm25),
    );
    return found ? { from: clock(found.start), to: clock(found.end) } : null;
  };
  const today = on("today");
  return today ? { kind: "wait", hours: today } : { kind: "indoors", tomorrow: on("tomorrow") };
}

/**
 * The engine's call on walks, play and sport outdoors for each group. It is
 * the ceiling the plan checker enforces, so a chat answer and the day's plan
 * never disagree, and the model never judges a level itself.
 */
export function outdoorCalls(ctx: Context): Record<string, Outdoors> {
  const members = ctx.profile.members;
  const sensitive = members.filter(isSensitive);
  const rest = members.filter((m) => !isSensitive(m));
  if (sensitive.length === 0) return { everyone: callFor(ctx.air, members) };
  return rest.length === 0
    ? { sensitive: callFor(ctx.air, sensitive) }
    : { sensitive: callFor(ctx.air, sensitive), everyoneElse: callFor(ctx.air, rest) };
}

/** A call in words the model passes on. */
export function inWords(call: Outdoors): string {
  switch (call.kind) {
    case "now":
      return "fine now";
    case "wait":
      return `wait until ${call.hours.from} to ${call.hours.to} today`;
    case "indoors":
      return call.tomorrow
        ? `indoors all day today; tomorrow from ${call.tomorrow.from} to ${call.tomorrow.to}`
        : "indoors all day today";
  }
}

/** Good or moderate: open up whenever suits, though the window is still cleaner. */
const AIR_FREELY = 1;

/**
 * The engine's call on opening the windows, timed like the plan's own airing
 * step: inside the first clean window, and never in a peak.
 */
export function airingCall(ctx: Context): string {
  const air = ctx.air;
  const fine = healthLevel(air.current.pm25) <= AIR_FREELY;
  const clean = air.windows[0];
  if (!clean) return fine ? "fine now" : "keep them shut today; no hour is cleaner than the rest";
  if (air.now >= clean.start && air.now < clean.end) return `open now, until ${clock(clean.end)}`;
  const hours = `${clock(clean.start)} to ${clock(clean.end)} ${dayName(clean.start, air.now)}`;
  return fine ? `fine now, cleanest from ${hours}` : `keep them shut now; open them from ${hours}`;
}
