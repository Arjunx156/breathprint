import { pm25At } from "../air";
import { healthLevel } from "../aqi";
import { inhalationRate, legHours, OPEN_MODES } from "../exposure";
import { type FactorId, type Pick, picker } from "../factors";
import type { MessageKey } from "../i18n";
import type { Member, TravelMode, Trip } from "../profile";
import {
  impact,
  minus,
  protectImpact,
  ranged,
  short,
  times,
  total,
  tripExposure,
  tripMembers,
} from "./models";
import type { ActionDef, Context, Impact } from "./types";

const pickMid = picker("mid");

type Motor = "car" | "twoWheeler" | "auto";
const MOTOR: ReadonlySet<TravelMode> = new Set<TravelMode>(["car", "twoWheeler", "auto"]);

/** kg CO2 per km for a private or hired motor vehicle. */
function co2PerKm(mode: Motor, p: Pick): number {
  if (mode === "car") return p("petrolCo2PerLitre") / p("carKmPerLitre");
  if (mode === "twoWheeler") return p("twoWheelerCo2PerKm");
  return p("autoCo2PerKm");
}

/** g PM2.5 per km of tyre, brake and road wear. Autos are lighter than cars. */
function wearPerKm(mode: Motor, p: Pick): number {
  return mode === "car" ? p("carNonExhaustPm25PerKm") : p("twoWheelerNonExhaustPm25PerKm");
}

/** Rupees per km: fuel for owned vehicles, the meter for autos. */
function inrPerKm(mode: Motor, p: Pick): number {
  if (mode === "car") return p("petrolInrPerLitre") / p("carKmPerLitre");
  if (mode === "twoWheeler") return p("petrolInrPerLitre") / p("twoWheelerKmPerLitre");
  return p("autoInrPerKm");
}

const roundTrip = (trip: Trip) => trip.km * 2;

function motorTrip(trip: Trip | null): trip is Trip & { mode: Motor } {
  return trip !== null && MOTOR.has(trip.mode);
}

/** An action's impact on one of the household's trips, or none when there is no such trip. */
const onTrip = (trip: Trip | null, measure: (trip: Trip) => Impact): Impact =>
  trip ? measure(trip) : impact({});

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
  eligible: (ctx) => motorTrip(ctx.profile.commute) && ctx.profile.commute.km >= 3,
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
  eligible: (ctx) => motorTrip(ctx.profile.commute) && ctx.profile.commute.km >= 2,
  impact: (ctx) => {
    const trip = ctx.profile.commute;
    return motorTrip(trip) ? switchImpact(ctx, trip, SWITCHES.bus) : impact({});
  },
};

/** A share of a car's daily running that disappears: carpools, combined errands, rotas. */
function carKmImpact(km: (p: Pick) => number, label: MessageKey): Impact {
  return impact({
    co2kg: ranged((p) => km(p) * co2PerKm("car", p)),
    pm25g: ranged((p) => km(p) * wearPerKm("car", p)),
    inrPerDay: ranged((p) => km(p) * inrPerKm("car", p)),
    method: [
      {
        label,
        formula: "km avoided × (CO2, wear and fuel per km)",
        result: `${short(km(pickMid))} km`,
      },
    ],
  });
}

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
    onTrip(ctx.profile.commute, (trip) => carKmImpact(() => roundTrip(trip) / 2, "method.carpool")),
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
      carKmImpact(() => (roundTrip(trip) * 2) / 3, "method.rota"),
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
    const litres = (p: Pick) => (p("idleLitresPerHour") * p("idleMinutesPerDay")) / 60;
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

/** What leaving a motor vehicle at home saves the street and the wallet; nothing for other modes. */
function motorSavings(trip: Trip) {
  if (!motorTrip(trip)) return { co2kg: null, pm25g: null, inrPerDay: null };
  const km = roundTrip(trip);
  return {
    co2kg: ranged((p) => km * co2PerKm(trip.mode, p)),
    pm25g: ranged((p) => km * wearPerKm(trip.mode, p)),
    inrPerDay: ranged((p) => km * inrPerKm(trip.mode, p)),
  };
}

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
    healthLevel(ctx.air.today.mean) >= 4,
  impact: (ctx) => onTrip(ctx.profile.commute, (trip) => stayHomeImpact(ctx, trip)),
};

/** N95 or FFP2 on open-air legs. Infants never wear masks. */
function maskImpact(ctx: Context, trip: Trip): Impact {
  const people = tripMembers(ctx, trip, { masks: true });
  const model = (p: Pick) =>
    total(
      people.map((m: Member) =>
        times(tripExposure(ctx, m, trip, trip.mode, p), 1 - p("maskLeakage")),
      ),
    );
  return protectImpact(ctx, people, model, {
    inrPerDay: ranged((p) => -(p("n95Inr") * people.length) / 3),
    method: [
      {
        label: "method.mask",
        formula: "trip dose × (1 − inward leakage)",
        result: `${short(pm25At(ctx.air, trip.leaveAt))} µg/m³ outside, ${Math.round((1 - pickMid("maskLeakage")) * 100)}% blocked`,
      },
    ],
  });
}

const openTrip = (ctx: Context, trip: Trip | null): trip is Trip =>
  trip !== null && OPEN_MODES.has(trip.mode) && healthLevel(pm25At(ctx.air, trip.leaveAt)) >= 2;

export const maskSchoolRun: ActionDef = {
  id: "mask-school-run",
  ledgers: ["protect"],
  category: "travel",
  timing: "schoolRun",
  cost: "low",
  sources: ["cherrie2018", "goel2015", "epaEfh2011"],
  quantified: true,
  appliesTo: (ctx) => tripMembers(ctx, ctx.profile.schoolRun, { masks: true }),
  eligible: (ctx) => openTrip(ctx, ctx.profile.schoolRun),
  impact: (ctx) => onTrip(ctx.profile.schoolRun, (trip) => maskImpact(ctx, trip)),
};

export const maskCommute: ActionDef = {
  id: "mask-commute",
  ledgers: ["protect"],
  category: "travel",
  timing: "commute",
  cost: "low",
  sources: ["cherrie2018", "goel2015", "epaEfh2011"],
  quantified: true,
  appliesTo: (ctx) => tripMembers(ctx, ctx.profile.commute, { masks: true }),
  eligible: (ctx) => openTrip(ctx, ctx.profile.commute),
  impact: (ctx) => onTrip(ctx.profile.commute, (trip) => maskImpact(ctx, trip)),
};

export const carRecirculate: ActionDef = {
  id: "car-recirculate",
  ledgers: ["protect"],
  category: "travel",
  timing: "commute",
  cost: "free",
  sources: ["goel2015", "epaEfh2011"],
  quantified: true,
  appliesTo: (ctx) =>
    [ctx.profile.commute, ctx.profile.schoolRun].flatMap((t) =>
      t?.mode === "car" ? tripMembers(ctx, t) : [],
    ),
  eligible: drivesCar,
  impact: (ctx) => {
    const trips = [ctx.profile.commute, ctx.profile.schoolRun].filter(
      (t): t is Trip => t?.mode === "car",
    );
    const people = [
      ...new Map(trips.flatMap((t) => tripMembers(ctx, t)).map((m) => [m.id, m])).values(),
    ];
    const model = (p: Pick) =>
      total(
        trips.flatMap((t) =>
          tripMembers(ctx, t).map((m) => {
            const hours = legHours("car", t.km, p);
            // Each leg takes `hours`, so summing both legs' air covers the round trip.
            const ambient = pm25At(ctx.air, t.leaveAt) + pm25At(ctx.air, t.returnAt);
            const delta = ambient * (p("ratioCarOpen") - p("ratioCarAc"));
            return {
              exposure: delta * hours,
              dose: delta * hours * inhalationRate(m.group, "rest"),
            };
          }),
        ),
      );
    return protectImpact(ctx, people, model, {
      method: [
        {
          label: "method.recirculate",
          formula: "C_out × (1.3 open − 0.5 recirculating) × time",
          result: `${short(model(pickMid).dose)} µg`,
        },
      ],
    });
  },
};
