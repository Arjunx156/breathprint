import { type Pick, picker } from "../factors";
import type { MessageKey } from "../i18n";
import type { TravelMode, Trip } from "../profile";
import type { Range } from "../range";
import { impact, ranged, short } from "./models";
import type { Impact } from "./types";

/*
 * What a motor vehicle costs per kilometre, for the street and for the
 * wallet. Every travel action prices the kilometres it changes through these.
 */

const pickMid = picker("mid");

/** The modes that burn fuel or run a meter. */
export type Motor = "car" | "twoWheeler" | "auto";
const MOTOR: ReadonlySet<TravelMode> = new Set<TravelMode>(["car", "twoWheeler", "auto"]);

/** kg CO2 per km for a private or hired motor vehicle. */
export function co2PerKm(mode: Motor, p: Pick): number {
  if (mode === "car") return p("petrolCo2PerLitre") / p("carKmPerLitre");
  if (mode === "twoWheeler") return p("twoWheelerCo2PerKm");
  return p("autoCo2PerKm");
}

/** g PM2.5 per km of tyre, brake and road wear. Autos are lighter than cars. */
export function wearPerKm(mode: Motor, p: Pick): number {
  return mode === "car" ? p("carNonExhaustPm25PerKm") : p("twoWheelerNonExhaustPm25PerKm");
}

/** Rupees per km: fuel for owned vehicles, the meter for autos. */
export function inrPerKm(mode: Motor, p: Pick): number {
  if (mode === "car") return p("petrolInrPerLitre") / p("carKmPerLitre");
  if (mode === "twoWheeler") return p("petrolInrPerLitre") / p("twoWheelerKmPerLitre");
  return p("autoInrPerKm");
}

/** Kilometres driven for a trip out and back. */
export const roundTrip = (trip: Trip) => trip.km * 2;

/** Whether a trip is made by a motor vehicle, so it has fuel, fares and wear to save. */
export function motorTrip(trip: Trip | null): trip is Trip & { mode: Motor } {
  return trip !== null && MOTOR.has(trip.mode);
}

/** A share of a car's daily running that disappears: carpools, combined errands, rotas. */
export function carKmImpact(km: (p: Pick) => number, label: MessageKey): Impact {
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

/** Per day, for a round trip; null where the mode burns nothing and costs nothing to run. */
export type Savings = { co2kg: Range | null; pm25g: Range | null; inrPerDay: Range | null };

/** What leaving a motor vehicle at home saves the street and the wallet; nothing for other modes. */
export function motorSavings(trip: Trip): Savings {
  if (!motorTrip(trip)) return { co2kg: null, pm25g: null, inrPerDay: null };
  const km = roundTrip(trip);
  return {
    co2kg: ranged((p) => km * co2PerKm(trip.mode, p)),
    pm25g: ranged((p) => km * wearPerKm(trip.mode, p)),
    inrPerDay: ranged((p) => km * inrPerKm(trip.mode, p)),
  };
}
