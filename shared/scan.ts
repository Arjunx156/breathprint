import { z } from "zod/mini";
import { type Candidate, rankActions } from "./actions/catalogue";
import type { Context } from "./actions/types";
import type { Profile } from "./profile";

/*
 * The room scan: Gemini names what it can see from a closed list, and the
 * engine turns each sighting into what it means for the home and the fixes
 * that answer it, ranked like any other step. The model never sees the
 * household and never puts a number on anything.
 */

export const ROOMS = ["kitchen", "bedroom", "living", "bathroom", "other", "notRoom"] as const;

export const SIGHTINGS = [
  "incense",
  "mosquito-coil",
  "stove-no-chimney",
  "chimney",
  "angithi",
  "kerosene-heater",
  "biomass-stove",
  "smoking",
  "open-window",
  "window-gaps",
  "purifier",
  "dry-sweeping",
] as const;

export type Room = (typeof ROOMS)[number];
export type Sighting = (typeof SIGHTINGS)[number];

/** A few words on where it is, so a family can check the model saw what is really there. */
export const WHERE_MAX = 90;

export const SightingSchema = z.object({
  kind: z.enum(SIGHTINGS),
  where: z.string().check(z.trim(), z.minLength(1), z.maxLength(WHERE_MAX)),
});

export const ScanSchema = z.object({
  room: z.enum(ROOMS),
  sightings: z.array(SightingSchema).check(z.maxLength(SIGHTINGS.length)),
});

export type Scan = z.infer<typeof ScanSchema>;

export const ScanReplySchema = z.object({
  scan: ScanSchema,
  model: z.string(),
  recorded: z.boolean(),
});

export type ScanReply = z.infer<typeof ScanReplySchema>;

type Home = Profile["home"];

/** What each sighting says about the home, as the household form would record it. */
const TELLS: Record<Sighting, Partial<Home>> = {
  incense: { incense: true },
  "mosquito-coil": { mosquitoCoil: true },
  "stove-no-chimney": { chimney: false },
  chimney: { chimney: true },
  angithi: { heating: "angithi" },
  "kerosene-heater": { heating: "kerosene" },
  "biomass-stove": { cooking: "biomass" },
  smoking: { smoking: true },
  "open-window": {},
  "window-gaps": { tightness: "leaky" },
  purifier: { purifier: true },
  "dry-sweeping": {},
};

/** The catalogue steps that answer each sighting. */
const FIXES: Record<Sighting, readonly string[]> = {
  incense: ["skip-incense"],
  "mosquito-coil": ["swap-coil"],
  "stove-no-chimney": ["cooking-vent"],
  chimney: [],
  angithi: ["heater-safety"],
  "kerosene-heater": ["heater-safety"],
  "biomass-stove": ["cleaner-cooking"],
  smoking: ["smoke-outside"],
  "open-window": ["ventilate-window"],
  "window-gaps": ["seal-gaps"],
  purifier: ["purifier-night"],
  "dry-sweeping": ["wet-cleaning"],
};

/** Each kind once, in the order it was first seen; a room that isn't one has nothing in it. */
export function sightingsOf(scan: Scan): Sighting[] {
  if (scan.room === "notRoom") return [];
  return [...new Set(scan.sightings.map((s) => s.kind))];
}

/** The home as the photo shows it. A gas stove seen with a chimney keeps its chimney. */
export function homeAfter(home: Home, kinds: readonly Sighting[]): Home {
  const next: Home = Object.assign({}, home, ...kinds.map((kind) => TELLS[kind]));
  return kinds.includes("chimney") ? { ...next, chimney: true } : next;
}

export type Change = { field: keyof Home; from: Home[keyof Home]; to: Home[keyof Home] };

/** What saving the scan would change in the household, field by field. */
export function homeChanges(home: Home, kinds: readonly Sighting[]): Change[] {
  const next = homeAfter(home, kinds);
  return (Object.keys(next) as (keyof Home)[])
    .filter((field) => next[field] !== home[field])
    .map((field) => ({ field, from: home[field], to: next[field] }));
}

/**
 * The fixes for what the room shows, ranked by the engine for this family
 * and today's air on the home as the photo shows it. Safety comes first,
 * then what each step does for the family and the street, cost counted.
 */
export function scanFixes(ctx: Context, kinds: readonly Sighting[]): Candidate[] {
  const wanted = new Set(kinds.flatMap((k) => FIXES[k]));
  if (wanted.size === 0) return [];
  const seen: Context = {
    ...ctx,
    profile: { ...ctx.profile, home: homeAfter(ctx.profile.home, kinds) },
  };
  return rankActions(seen).filter((c) => wanted.has(c.action.id));
}

/** The scanned household, ready for the engine and for Today. */
export function withSightings(profile: Profile, kinds: readonly Sighting[]): Profile {
  return { ...profile, home: homeAfter(profile.home, kinds) };
}
