import type { AirSnapshot } from "../../shared/air";
import { TtlCache } from "../cache";

/** Anything that can give the hourly air for a grid cell: Open-Meteo, a fixture, a station network. */
export type AirSource = {
  name: AirSnapshot["source"];
  snapshot(lat: number, lon: number, signal?: AbortSignal): Promise<AirSnapshot>;
};

export class UpstreamError extends Error {
  readonly service: string;

  constructor(service: string, detail: string) {
    super(`${service}: ${detail}`);
    this.name = "UpstreamError";
    this.service = service;
  }
}

/** Forecasts update hourly at best, so half an hour per cell is plenty fresh. */
const AIR_TTL_MS = 30 * 60_000;

/** Wraps a source so each grid cell is fetched at most once per TTL, however many ask. */
export function cached(source: AirSource, ttlMs = AIR_TTL_MS): AirSource {
  const cache = new TtlCache<AirSnapshot>(ttlMs);
  return {
    name: source.name,
    // The load is shared, so one caller hanging up must not cancel it for the rest.
    snapshot: (lat, lon) =>
      cache.getOrLoad(`${lat.toFixed(1)},${lon.toFixed(1)}`, () => source.snapshot(lat, lon)),
  };
}
