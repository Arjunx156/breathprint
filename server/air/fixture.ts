import { DEMO_DAY, delhiSevereSnapshot } from "@shared/fixtures";
import type { AirSource } from "./source";

/** The demo's severe Delhi spell for every cell: for tests, offline work and drills. */
export function fixtureSource(day = DEMO_DAY): AirSource {
  return {
    name: "fixture",
    snapshot: async (lat, lon) => ({ ...delhiSevereSnapshot(day), lat, lon }),
  };
}
