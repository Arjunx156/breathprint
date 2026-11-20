import { coarse, type Place } from "@shared/profile";
import { z } from "zod";
import { UpstreamError } from "./air/source";

const ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";
const TIMEOUT_MS = 6000;

const ResponseSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country_code: z.string().length(2).optional(),
        admin1: z.string().optional(),
        country: z.string().optional(),
      }),
    )
    .default([]),
});

/** Finds places by name, rounded to the forecast grid. */
export type Geocoder = (query: string, lang: "en" | "hi") => Promise<Place[]>;

/** Place search through Open-Meteo's keyless geocoder, rounded to the forecast grid. */
export function openMeteoGeocoder(fetcher: typeof fetch = fetch): Geocoder {
  return async (query, lang) => {
    const url = new URL(ENDPOINT);
    url.search = new URLSearchParams({
      name: query,
      count: "6",
      language: lang,
      format: "json",
    }).toString();
    const res = await fetcher(url, { signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(
      (e: unknown) => {
        throw new UpstreamError("geocoding", e instanceof Error ? e.name : "network");
      },
    );
    if (!res.ok) throw new UpstreamError("geocoding", `status ${res.status}`);
    const parsed = ResponseSchema.safeParse(await res.json());
    if (!parsed.success) throw new UpstreamError("geocoding", "unexpected response shape");
    return parsed.data.results
      .filter((r) => r.country_code !== undefined)
      .map((r) => ({
        name: [r.name, r.admin1, r.country].filter(Boolean).join(", ").slice(0, 80),
        lat: coarse(r.latitude),
        lon: coarse(r.longitude),
        country: (r.country_code ?? "").toUpperCase(),
      }));
  };
}
