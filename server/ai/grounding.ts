import { type Candidate, rankActions } from "@shared/actions/catalogue";
import type { Context } from "@shared/actions/types";
import { summarize } from "@shared/air";
import { THRESHOLDS } from "@shared/factors";
import { severeDay } from "@shared/fixtures";
import { clock } from "@shared/format";
import { isMessageKey, t, tx } from "@shared/i18n";
import { ruleReason } from "@shared/i18n/reason";
import { CARDS } from "@shared/knowledge/cards";
import { search } from "@shared/knowledge/search";
import { selectSteps, timeFor } from "@shared/plan";
import { forModel, isSensitive, type Profile } from "@shared/profile";
import { sourceOf } from "@shared/sources";
import type { AirSource } from "../air/source";
import { airingCall, dayName, inWords, outdoorCalls } from "./outdoors";

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
    return severeDay(safe);
  }
  return { profile: safe, air: summarize(await air.snapshot(safe.place.lat, safe.place.lon), now) };
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
    meanPm25: Math.round(win.meanPm25),
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
    pm25Now: Math.round(air.current.pm25),
    whoDailyGuideline: THRESHOLDS.whoDaily,
    today: { meanPm25: Math.round(air.today.mean), maxPm25: Math.round(air.today.max) },
    tomorrowMeanPm25: air.tomorrow ? Math.round(air.tomorrow.mean) : null,
    outdoorExercise: Object.fromEntries(
      Object.entries(outdoorCalls(ctx)).map(([who, call]) => [who, inWords(call)]),
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
export function optionsFor(
  ctx: Context,
  ranked: readonly Candidate[] = rankActions(ctx),
): Candidate[] {
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
    sources: c.sources.map(sourceOf).map((s) => `${s.publisher} ${s.year}`),
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
