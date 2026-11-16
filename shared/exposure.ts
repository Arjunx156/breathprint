import { type Activity, type FactorId, INHALATION, type Pick } from "./factors";
import type { Member, Profile, TravelMode, Trip } from "./profile";

/** m3 of air a person breathes per hour at a given effort. */
export function inhalationRate(group: Member["group"], activity: Activity): number {
  return INHALATION[group][activity];
}

/** Micrograms of PM2.5 breathed in: concentration x breathing rate x time. */
export function dose(concentration: number, ratePerHour: number, hours: number): number {
  return Math.max(0, concentration) * ratePerHour * Math.max(0, hours);
}

export type Room = {
  outdoor: number;
  airExchange: number;
  penetration: number;
  deposition: number;
  /** Clean air delivery rate of any filter running, m3 per hour. */
  cadr: number;
  volume: number;
  /** Indoor emissions, ug per hour (incense, coils, cooking). */
  source: number;
};

/**
 * Steady-state PM2.5 in a single well-mixed room:
 * C_in = (P * a * C_out + S / V) / (a + k + CADR / V)
 */
export function indoorConcentration(room: Room): number {
  const removal = room.airExchange + room.deposition + room.cadr / room.volume;
  const gain =
    room.penetration * room.airExchange * Math.max(0, room.outdoor) + room.source / room.volume;
  return removal <= 0 ? room.outdoor : gain / removal;
}

/**
 * Extra exposure from a burst of indoor emissions: every microgram released is
 * eventually removed by air exchange and settling, so the area under the
 * concentration curve is mass / (V * (a + k)), whatever the burn time.
 */
export function burstExposure(
  massUg: number,
  volume: number,
  airExchange: number,
  deposition: number,
): number {
  return massUg / (volume * (airExchange + deposition));
}

const TIGHTNESS_FACTOR: Record<Profile["home"]["tightness"], FactorId> = {
  leaky: "airExchangeLeaky",
  average: "airExchangeAverage",
  tight: "airExchangeTight",
};

export function airExchangeOf(profile: Profile, pick: Pick): number {
  return pick(TIGHTNESS_FACTOR[profile.home.tightness]);
}

/** The home's indoor PM2.5 with windows shut and nothing burning. */
export function homeConcentration(profile: Profile, outdoor: number, pick: Pick, cadr = 0): number {
  return indoorConcentration({
    outdoor,
    airExchange: airExchangeOf(profile, pick),
    penetration: pick("penetration"),
    deposition: pick("deposition"),
    cadr,
    volume: pick("roomVolume"),
    source: 0,
  });
}

type OpenMode = Exclude<TravelMode, "none">;

const RATIO: Record<OpenMode, FactorId> = {
  walk: "ratioWalk",
  cycle: "ratioCycle",
  twoWheeler: "ratioTwoWheeler",
  car: "ratioCarAc",
  auto: "ratioAuto",
  bus: "ratioBus",
  metro: "ratioMetro",
};

const SPEED: Record<OpenMode, FactorId> = {
  walk: "speedWalk",
  cycle: "speedCycle",
  twoWheeler: "speedTwoWheeler",
  car: "speedCar",
  auto: "speedAuto",
  bus: "speedBus",
  metro: "speedMetro",
};

/** Walking at city pace is about 3 METs, EPA's "light" band; cycling sits in "moderate". */
const EFFORT: Record<OpenMode, Activity> = {
  walk: "light",
  cycle: "moderate",
  twoWheeler: "rest",
  car: "rest",
  auto: "rest",
  bus: "rest",
  metro: "rest",
};

/** Modes where the traveller breathes street air directly. */
export const OPEN_MODES: ReadonlySet<TravelMode> = new Set(["walk", "cycle", "twoWheeler", "auto"]);

/** Hours one leg of a trip takes. */
export function legHours(mode: TravelMode, km: number, pick: Pick): number {
  if (mode === "none" || km <= 0) return 0;
  return km / pick(SPEED[mode]);
}

/** Concentration x hours, and the dose it implies for one person. */
export type Exposure = { exposure: number; dose: number };

/** Minutes of walking to and from a metro station or bus stop, per leg. */
const ACCESS_HOURS: Partial<Record<OpenMode, number>> = { metro: 0.25, bus: 0.1 };

/**
 * What one member breathes on a single leg: the ride itself at the mode's
 * on-road ratio, plus the walk to the station for metro and bus.
 */
export function leg(
  member: Member,
  mode: TravelMode,
  km: number,
  ambient: number,
  pick: Pick,
): Exposure {
  if (mode === "none" || km <= 0) return { exposure: 0, dose: 0 };
  const rideC = ambient * pick(RATIO[mode]);
  const rideH = legHours(mode, km, pick);
  const walkC = ambient * pick("ratioWalk");
  const walkH = ACCESS_HOURS[mode] ?? 0;
  return {
    exposure: rideC * rideH + walkC * walkH,
    dose:
      dose(rideC, inhalationRate(member.group, EFFORT[mode]), rideH) +
      dose(walkC, inhalationRate(member.group, "light"), walkH),
  };
}

export function legDose(
  member: Member,
  mode: TravelMode,
  km: number,
  ambient: number,
  pick: Pick,
): number {
  return leg(member, mode, km, ambient, pick).dose;
}

export function membersOn(profile: Profile, trip: Trip | null): Member[] {
  if (!trip) return [];
  return profile.members.filter((m) => trip.who.includes(m.id));
}

const toHours = (clock: string) => Number(clock.slice(0, 2)) + Number(clock.slice(3, 5)) / 60;

/** Hours a member spends away from home on their trips, assuming they stay indoors there. */
export function hoursAway(profile: Profile, member: Member): number {
  const trips = [profile.commute, profile.schoolRun].filter(
    (t): t is Trip => t?.who.includes(member.id) === true,
  );
  const away = trips.map((t) => {
    const span = toHours(t.returnAt) - toHours(t.leaveAt);
    return Math.max(span, 0);
  });
  return Math.min(16, Math.max(0, ...away));
}

/**
 * A member's PM2.5 dose for an ordinary indoor day: eight hours asleep and
 * sixteen awake, at home or at work or school. Savings are stated as a share
 * of this, so a commuter's saving is not inflated by their short day at home.
 */
export function dailyDose(member: Member, indoor: number): number {
  return (
    dose(indoor, inhalationRate(member.group, "sleep"), 8) +
    dose(indoor, inhalationRate(member.group, "rest"), 16)
  );
}
