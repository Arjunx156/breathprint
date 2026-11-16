import { overnightPm25, pm25At } from "../air";
import {
  airExchangeOf,
  dailyDose,
  type Exposure,
  homeConcentration,
  inhalationRate,
  leg,
} from "../exposure";
import { type Activity, type FactorId, type Pick, picker } from "../factors";
import { short } from "../format";
import { isSensitive, type Member, type Profile, type TravelMode, type Trip } from "../profile";
import { type Bound, type Range, spread } from "../range";
import { type Context, type Impact, NO_IMPACT } from "./types";

export type { Exposure };

const ZERO: Exposure = { exposure: 0, dose: 0 };

export function exposed(
  member: Member,
  deltaC: number,
  hours: number,
  activity: Activity,
): Exposure {
  return {
    exposure: deltaC * hours,
    dose: deltaC * hours * inhalationRate(member.group, activity),
  };
}

export function total(parts: readonly Exposure[]): Exposure {
  return parts.reduce(
    (a, b) => ({ exposure: a.exposure + b.exposure, dose: a.dose + b.dose }),
    ZERO,
  );
}

/** Evaluates a protect model at low, mid and high factor values. */
export function protectRanges(model: (pick: Pick) => Exposure): { dose: Range; exposure: Range } {
  const runs = {
    low: model(picker("low")),
    mid: model(picker("mid")),
    high: model(picker("high")),
  };
  const of = (key: keyof Exposure) => spread((b: Bound) => runs[b][key]);
  return { dose: of("dose"), exposure: of("exposure") };
}

/** Evaluates any numeric model at low, mid and high factor values. */
export function ranged(model: (pick: Pick) => number): Range {
  return spread((b) => model(picker(b)));
}

const mid = picker("mid");

/**
 * Share of the covered people's day that a dose saving represents. The
 * ordinary day is modelled from outdoor air alone, so a habit that adds its
 * own smoke (incense, a coil) is added back to the day it is a share of;
 * otherwise a strong source on a clean day would read as more than 100%.
 */
export function shareOfDay(
  ctx: Context,
  people: readonly Member[],
  doseMid: number,
  sourceDose = 0,
): number | null {
  if (people.length === 0) return null;
  const indoor = homeConcentration(ctx.profile, ctx.air.today.mean, mid);
  const day = people.reduce((acc, m) => acc + dailyDose(m, indoor), 0) + Math.max(0, sourceDose);
  return day > 0 ? doseMid / day : null;
}

export function impact(partial: Partial<Impact>): Impact {
  return { ...NO_IMPACT, ...partial };
}

/**
 * Protect-ledger impact from a model, with share-of-day attached. Pass
 * `removesSource` when the saving is a household's own smoke going away.
 */
export function protectImpact(
  ctx: Context,
  people: Member[],
  model: (pick: Pick) => Exposure,
  rest: Partial<Impact> = {},
  removesSource = false,
): Impact {
  const { dose, exposure } = protectRanges(model);
  return impact({
    people: people.map((m) => m.id),
    dose,
    exposure,
    doseShare: shareOfDay(ctx, people, dose.mid, removesSource ? dose.mid : 0),
    ...rest,
  });
}

/** The people who share the bedroom a filter or a coil sits in: the most sensitive, up to three. */
export function bedroomGroup(ctx: Context): Member[] {
  const sensitive = ctx.profile.members.filter(isSensitive);
  return (sensitive.length > 0 ? sensitive : ctx.profile.members).slice(0, 3);
}

const toMinutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));

/** Whether a member is out on one of their trips at a given clock time. */
export function awayAt(profile: Profile, member: Member, clock: string): boolean {
  const t = toMinutes(clock);
  return [profile.commute, profile.schoolRun].some(
    (trip) =>
      trip?.who.includes(member.id) === true &&
      t >= toMinutes(trip.leaveAt) &&
      t < toMinutes(trip.returnAt),
  );
}

export function homeAt(ctx: Context, clock: string): Member[] {
  return ctx.profile.members.filter((m) => !awayAt(ctx.profile, m, clock));
}

export function tripMembers(
  ctx: Context,
  trip: Trip | null,
  opts: { masks?: boolean } = {},
): Member[] {
  if (!trip) return [];
  return ctx.profile.members.filter(
    (m) => trip.who.includes(m.id) && !(opts.masks && m.group === "infant"),
  );
}

/** Both legs of a trip for one member, each at the air forecast for its hour. */
export function tripExposure(
  ctx: Context,
  member: Member,
  trip: Trip,
  mode: TravelMode,
  pick: Pick,
): Exposure {
  return total([
    leg(member, mode, trip.km, pm25At(ctx.air, trip.leaveAt), pick),
    leg(member, mode, trip.km, pm25At(ctx.air, trip.returnAt), pick),
  ]);
}

export function minus(a: Exposure, b: Exposure): Exposure {
  return { exposure: a.exposure - b.exposure, dose: a.dose - b.dose };
}

export function times(a: Exposure, k: number): Exposure {
  return { exposure: a.exposure * k, dose: a.dose * k };
}

export const overnight = (ctx: Context) => overnightPm25(ctx.air);

export function homeIndoor(ctx: Context, outdoor: number, pick: Pick, cadr = 0): number {
  return homeConcentration(ctx.profile, outdoor, pick, cadr);
}

export function airExchange(ctx: Context, pick: Pick): number {
  return airExchangeOf(ctx.profile, pick);
}

/** Running cost of an appliance for some hours, in rupees per day (negative). */
export function runningCost(watts: FactorId, hours: number): Range {
  return ranged((p) => (-(p(watts) * hours) / 1000) * p("electricityInrPerKwh"));
}

/** CO2 from an appliance's electricity, as a negative saving. */
export function runningCo2(watts: FactorId, hours: number): Range {
  return ranged((p) => (-(p(watts) * hours) / 1000) * p("gridCo2PerKwh"));
}

export function fmtRange(r: Range): string {
  return `${short(r.mid)} (${short(r.low)} to ${short(r.high)})`;
}

export { short };
