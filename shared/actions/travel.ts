import { healthLevel, LEVEL } from "../aqi";
import { type FactorId, type Pick, picker } from "../factors";
import type { Trip } from "../profile";
import {
  impact,
  minus,
  onTrip,
  protectImpact,
  ranged,
  short,
  total,
  tripExposure,
  tripMembers,
} from "./models";
import type { ActionDef, Context, Impact } from "./types";
import {
  carKmImpact,
  co2PerKm,
  inrPerKm,
  type Motor,
  motorSavings,
  motorTrip,
  roundTrip,
  wearPerKm,
} from "./vehicles";

/*
 * Prevent actions for the household's trips: leave the car or bike for public
 * transport, share it, drive it less, or skip the commute on the worst days.
 * Masks and recirculation, which protect the people on the trip, are in
 * tripProtect.ts.
 */

const pickMid = picker("mid");

/** The shortest one-way commute, in km, each switch is offered for. */
const METRO_MIN_KM = 3;
const BUS_MIN_KM = 2;

/** Share of car kilometres a carpool of two saves: each car drives every other day. */
const CARPOOL_SAVES = 1 / 2;
/** Share a school-run rota of three families saves: each drives one day in three. */
const ROTA_SAVES = 2 / 3;

type Switch = { to: "metro" | "bus"; co2: FactorId; fare: FactorId; wear: FactorId | null };

const SWITCHES: Record<"metro" | "bus", Switch> = {
  metro: { to: "metro", co2: "metroCo2PerPkm", fare: "metroFareInr", wear: null },
  bus: { to: "bus", co2: "busCo2PerPkm", fare: "busFareInr", wear: "busNonExhaustPm25PerPkm" },
};

/**
 * Switching one person's commute from a motor vehicle to public transport:
 * both ledgers, the money, and the honest change in their own dose.
 */
function switchImpact(ctx: Context, trip: Trip & { mode: Motor }, sw: Switch): Impact {
  const km = roundTrip(trip);
  const commuters = tripMembers(ctx, trip);
  const model = (p: Pick) =>
    total(
      commuters.map((m) =>
        minus(tripExposure(ctx, m, trip, trip.mode, p), tripExposure(ctx, m, trip, sw.to, p)),
      ),
    );
  return protectImpact(ctx, commuters, model, {
    co2kg: ranged((p) => km * (co2PerKm(trip.mode, p) - p(sw.co2))),
    pm25g: ranged((p) => km * (wearPerKm(trip.mode, p) - (sw.wear ? p(sw.wear) : 0))),
    // Two fares a day: out and back.
    inrPerDay: ranged((p) => km * inrPerKm(trip.mode, p) - 2 * p(sw.fare)),
    method: [
      {
        label: "method.co2Switch",
        formula: `${km} km × (vehicle − ${sw.to}) kg CO2/km`,
        result: `${short(km * co2PerKm(trip.mode, pickMid))} → ${short(km * pickMid(sw.co2))} kg`,
      },
      {
        label: "method.wear",
        formula: "km × tyre, brake and road wear (g/km)",
        result: `${short(km * wearPerKm(trip.mode, pickMid))} g PM2.5`,
      },
      {
        label: "method.tripDose",
        formula: "C_out × microenvironment ratio × breathing rate × time",
        result: `${short(model(pickMid).dose)} µg`,
      },
    ],
  });
}

export const commuteMetro: ActionDef = {
  id: "commute-metro",
  group: "commute",
  ledgers: ["prevent", "protect"],
  category: "travel",
  timing: "commute",
  cost: "free",
  sources: ["indiaGhg2015", "unepMetro2014", "oecd2020", "goel2015", "dmrcFares"],
  quantified: true,
  appliesTo: (ctx) => tripMembers(ctx, ctx.profile.commute),
  eligible: (ctx) => motorTrip(ctx.profile.commute) && ctx.profile.commute.km >= METRO_MIN_KM,
  impact: (ctx) => {
    const trip = ctx.profile.commute;
    return motorTrip(trip) ? switchImpact(ctx, trip, SWITCHES.metro) : impact({});
  },
};

export const commuteBus: ActionDef = {
  id: "commute-bus",
  group: "commute",
  ledgers: ["prevent", "protect"],
  category: "travel",
  timing: "commute",
  cost: "free",
  sources: ["indiaGhg2015", "oecd2020", "goel2015"],
  quantified: true,
  appliesTo: (ctx) => tripMembers(ctx, ctx.profile.commute),
  eligible: (ctx) => motorTrip(ctx.profile.commute) && ctx.profile.commute.km >= BUS_MIN_KM,
  impact: (ctx) => {
    const trip = ctx.profile.commute;
    return motorTrip(trip) ? switchImpact(ctx, trip, SWITCHES.bus) : impact({});
  },
};

const drivesCar = (ctx: Context) =>
  ctx.profile.commute?.mode === "car" || ctx.profile.schoolRun?.mode === "car";

export const carpool: ActionDef = {
  id: "carpool",
  group: "commute",
  ledgers: ["prevent"],
  category: "travel",
  timing: "commute",
  cost: "free",
  sources: ["indiaGhg2015", "oecd2020"],
  quantified: true,
  appliesTo: (ctx) => tripMembers(ctx, ctx.profile.commute),
  eligible: (ctx) => ctx.profile.commute?.mode === "car",
  impact: (ctx) =>
    onTrip(ctx.profile.commute, (trip) =>
      carKmImpact(() => roundTrip(trip) * CARPOOL_SAVES, "method.carpool"),
    ),
};

export const schoolCarpool: ActionDef = {
  id: "school-carpool",
  ledgers: ["prevent"],
  category: "travel",
  timing: "schoolRun",
  cost: "free",
  sources: ["indiaGhg2015", "oecd2020"],
  quantified: true,
  appliesTo: (ctx) => tripMembers(ctx, ctx.profile.schoolRun),
  eligible: (ctx) => ctx.profile.schoolRun?.mode === "car",
  impact: (ctx) =>
    onTrip(ctx.profile.schoolRun, (trip) =>
      carKmImpact(() => roundTrip(trip) * ROTA_SAVES, "method.rota"),
    ),
};

export const combineErrands: ActionDef = {
  id: "combine-errands",
  ledgers: ["prevent"],
  category: "travel",
  timing: "afternoon",
  cost: "free",
  sources: ["indiaGhg2015", "oecd2020"],
  quantified: true,
  appliesTo: () => [],
  eligible: drivesCar,
  impact: () => carKmImpact((p) => p("errandKmAvoided"), "method.errands"),
};

const MINUTES_PER_HOUR = 60;

export const engineOff: ActionDef = {
  id: "engine-off",
  ledgers: ["prevent"],
  category: "travel",
  timing: "commute",
  cost: "free",
  sources: ["doeIdling", "indiaGhg2015"],
  quantified: true,
  appliesTo: () => [],
  eligible: drivesCar,
  impact: () => {
    const litres = (p: Pick) =>
      (p("idleLitresPerHour") * p("idleMinutesPerDay")) / MINUTES_PER_HOUR;
    return impact({
      co2kg: ranged((p) => litres(p) * p("petrolCo2PerLitre")),
      inrPerDay: ranged((p) => litres(p) * p("petrolInrPerLitre")),
      method: [
        {
          label: "method.idling",
          formula: "idle litres per hour × minutes stopped / 60",
          result: `${short(litres(pickMid))} L`,
        },
      ],
    });
  },
};

/** Both legs of a commute not made: the dose the commuters skip and what the vehicle doesn't burn. */
function stayHomeImpact(ctx: Context, trip: Trip): Impact {
  const commuters = tripMembers(ctx, trip);
  const model = (p: Pick) => total(commuters.map((m) => tripExposure(ctx, m, trip, trip.mode, p)));
  return protectImpact(ctx, commuters, model, {
    ...motorSavings(trip),
    method: [
      {
        label: "method.tripDose",
        formula: "both legs of the commute, not made",
        result: `${short(model(pickMid).dose)} µg`,
      },
    ],
  });
}

export const workFromHome: ActionDef = {
  id: "work-from-home",
  group: "commute",
  ledgers: ["prevent", "protect"],
  category: "travel",
  timing: "commute",
  cost: "free",
  sources: ["indiaGhg2015", "goel2015", "caqmGrap"],
  quantified: true,
  appliesTo: (ctx) => tripMembers(ctx, ctx.profile.commute),
  eligible: (ctx) =>
    ctx.profile.commute !== null &&
    ctx.profile.commute.mode !== "none" &&
    healthLevel(ctx.air.today.mean) >= LEVEL.veryUnhealthy,
  impact: (ctx) => onTrip(ctx.profile.commute, (trip) => stayHomeImpact(ctx, trip)),
};
