import { exertionCeiling } from "../../shared/actions/activity";
import { type Candidate, rankActions } from "../../shared/actions/catalogue";
import type { Context } from "../../shared/actions/types";
import { summarize } from "../../shared/air";
import { healthLevel } from "../../shared/aqi";
import { THRESHOLDS } from "../../shared/factors";
import { DEMO_DAY, delhiMorning, delhiSevereSnapshot } from "../../shared/fixtures";
import { clock, dayOf } from "../../shared/format";
import { isMessageKey, t, tx } from "../../shared/i18n";
import { ruleReason } from "../../shared/i18n/reason";
import { CARDS } from "../../shared/knowledge/cards";
import { search } from "../../shared/knowledge/search";
import { selectSteps, timeFor } from "../../shared/plan";
import { forModel, isSensitive, type Profile } from "../../shared/profile";
import { sourceOf } from "../../shared/sources";
import { DAY_MS } from "../../shared/time";
import type { AirSource } from "../air/source";

/**
 * The air and household a model is told about. The forecast is the server's
 * own and the household is stripped of names and rounded to the grid, so
 * nothing the browser claims about the air reaches a prompt.
 */
export async function contextFor(
  air: AirSource,
  profile: Profile,
  demo: boolean,
  now = Date.now(),
): Promise<Context> {
  const safe = forModel(profile);
  if (demo) {
    return { profile: safe, air: summarize(delhiSevereSnapshot(DEMO_DAY), delhiMorning(DEMO_DAY)) };
  }
  return { profile: safe, air: summarize(await air.snapshot(safe.place.lat, safe.place.lon), now) };
}

const round = (x: number) => Math.round(x);

/** The forecast runs past midnight, so a window's hours alone don't say which day it is. */
function dayName(time: string, now: string): string {
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

/**
 * The engine's call on walks, play and sport outdoors for each group. It is
 * the ceiling the plan checker enforces, so a chat answer and the day's plan
 * never disagree, and the model never judges a level itself.
 */
export function outdoorCalls(ctx: Context): Record<string, Outdoors> {
  const air = ctx.air;
  const call = (people: Members): Outdoors => {
    const ok = (pm25: number) => healthLevel(pm25) <= exertionCeiling(people);
    if (ok(air.current.pm25)) return { kind: "now" };
    const on = (day: string) => {
      const found = air.windows.find(
        (win) => dayName(win.start, air.now) === day && ok(win.meanPm25),
      );
      return found ? { from: clock(found.start), to: clock(found.end) } : null;
    };
    const today = on("today");
    return today ? { kind: "wait", hours: today } : { kind: "indoors", tomorrow: on("tomorrow") };
  };
  const members = ctx.profile.members;
  const sensitive = members.filter(isSensitive);
  const rest = members.filter((m) => !isSensitive(m));
  if (sensitive.length === 0) return { everyone: call(members) };
  return rest.length === 0
    ? { sensitive: call(sensitive) }
    : { sensitive: call(sensitive), everyoneElse: call(rest) };
}

/** A call in words the model passes on. */
function said(o: Outdoors): string {
  switch (o.kind) {
    case "now":
      return "fine now";
    case "wait":
      return `wait until ${o.hours.from} to ${o.hours.to} today`;
    case "indoors":
      return o.tomorrow
        ? `indoors all day today; tomorrow from ${o.tomorrow.from} to ${o.tomorrow.to}`
        : "indoors all day today";
  }
}

/** Good or moderate: open up whenever suits, though the window is still cleaner. */
const AIR_FREELY = 1;

/**
 * The engine's call on opening the windows, timed like the plan's own airing
 * step: inside the first clean window, and never in a peak.
 */
function airingCall(ctx: Context): string {
  const air = ctx.air;
  const fine = healthLevel(air.current.pm25) <= AIR_FREELY;
  const clean = air.windows[0];
  if (!clean) return fine ? "fine now" : "keep them shut today; no hour is cleaner than the rest";
  if (air.now >= clean.start && air.now < clean.end) return `open now, until ${clock(clean.end)}`;
  const hours = `${clock(clean.start)} to ${clock(clean.end)} ${dayName(clean.start, air.now)}`;
  return fine ? `fine now, cleanest from ${hours}` : `keep them shut now; open them from ${hours}`;
}

/** Today's air in the terms the app shows: the chosen AQI scale, PM2.5 and the clean windows. */
export function airFacts(ctx: Context) {
  const air = ctx.air;
  const scale = ctx.profile.scale;
  const reading = air.current.aqi[scale];
  const span = (win: (typeof air.windows)[number]) => ({
    day: dayName(win.start, air.now),
    from: clock(win.start),
    to: clock(win.end),
    meanPm25: round(win.meanPm25),
  });
  return {
    place: ctx.profile.place.name,
    localTime: clock(air.now),
    aqi: {
      scale: scale === "IN" ? "India NAQI" : "US AQI",
      value: reading.value,
      category: tx("en", `aqi.${scale}.${reading.category}`),
    },
    healthLevel: air.current.health,
    pm25Now: round(air.current.pm25),
    whoDailyGuideline: THRESHOLDS.whoDaily,
    today: { meanPm25: round(air.today.mean), maxPm25: round(air.today.max) },
    tomorrowMeanPm25: air.tomorrow ? round(air.tomorrow.mean) : null,
    outdoorExercise: Object.fromEntries(
      Object.entries(outdoorCalls(ctx)).map(([who, call]) => [who, said(call)]),
    ),
    airing: airingCall(ctx),
    cleanWindows: air.windows.map(span),
    peaks: air.peaks.map(span),
    flatDay: air.flat,
    unit: "µg/m³",
  };
}

/** The household by role and need; ids are the only way the model can name anyone. */
export function householdFacts(profile: Profile) {
  return {
    members: profile.members.map((m) => ({
      id: m.id,
      group: m.group,
      conditions: m.conditions,
      outdoorWork: m.outdoorWork,
      sensitive: isSensitive(m),
    })),
    home: profile.home,
    commute: profile.commute,
    schoolRun: profile.schoolRun,
    exercise: profile.exercise,
    budget: profile.budget,
  };
}

const MAX_OPTIONS = 16;

/**
 * The actions a model may choose from: anything safety-critical, the rule
 * plan's own picks (so a passing plan always exists), then the best of the rest.
 */
export function optionsFor(ctx: Context, ranked: readonly Candidate[] = rankActions(ctx)) {
  const safety = ranked.filter((c) => c.action.safety);
  return [...new Set([...safety, ...selectSteps(ctx, ranked), ...ranked])].slice(
    0,
    Math.max(MAX_OPTIONS, safety.length),
  );
}

/** What each option does for this family, in the engine's own words and figures. */
export function optionFacts(ctx: Context, options: readonly Candidate[]) {
  const explain = ruleReason("en");
  return options.map((c) => {
    const id = c.action.id;
    const title = `action.${id}.title`;
    const time = timeFor(ctx, c.action);
    return {
      id,
      title: isMessageKey(title) ? t("en", title) : id,
      group: c.action.group ?? null,
      ledgers: c.action.ledgers,
      safety: c.action.safety === true,
      outdoorExertion: c.action.outdoorExertion === true,
      cost: c.action.cost,
      suggestedTime: time,
      covers: c.who,
      effect: explain(ctx, c, time),
    };
  });
}

const MAX_CARDS = 6;
/** Cards found by searching the question, and options whose cards come along. */
const SEARCH_HITS = 4;
const TOP_OPTIONS = 3;

/** The cited cards that best answer a question, plus those behind the top options. */
export function cardFacts(question: string, options: readonly Candidate[]) {
  const top = new Set(options.slice(0, TOP_OPTIONS).map((c) => c.action.id));
  const found = search(question, SEARCH_HITS).map((h) => h.card);
  const related = CARDS.filter((card) => card.actions.some((id) => top.has(id)));
  const unique = new Map([...found, ...related].map((c) => [c.id, c]));
  return [...unique.values()].slice(0, MAX_CARDS).map((c) => ({
    id: c.id,
    title: c.title,
    body: c.body,
    sources: c.sources.map((s) => `${sourceOf(s).publisher} ${sourceOf(s).year}`),
  }));
}

/** Every number a packet states, which is every number a reply may repeat. */
export function numbersIn(packet: unknown): number[] {
  // Walked, not stringified: JSON would join [13,14] into one "13,14".
  if (typeof packet === "number") return [packet];
  if (typeof packet === "string")
    return [...packet.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => Number(m[0].replaceAll(",", "")));
  if (Array.isArray(packet)) return packet.flatMap(numbersIn);
  if (packet && typeof packet === "object") return Object.values(packet).flatMap(numbersIn);
  return [];
}
