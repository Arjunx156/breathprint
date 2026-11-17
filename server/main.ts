import type { Place } from "../shared/profile";
import { fixtureSource } from "./air/fixture";
import { openMeteo } from "./air/openMeteo";
import { cached } from "./air/source";
import { createApp, type Deps } from "./app";
import { TtlCache } from "./cache";
import { type Env, loadEnv } from "./env";
import type { Geocoder } from "./geocode";
import { openMeteoGeocoder } from "./geocode";
import { llmFromEnv } from "./llm/config";

const DAY_MS = 86_400_000;

function cachedGeocoder(geocode: Geocoder): Geocoder {
  const cache = new TtlCache<Place[]>(DAY_MS, 2000);
  return (query, lang) =>
    cache.getOrLoad(`${lang}:${query.toLowerCase()}`, () => geocode(query, lang));
}

/** Production wiring: real upstreams behind caches, chosen by configuration. */
export function productionDeps(env: Env): Deps {
  return {
    env,
    air: cached(env.AIR_SOURCE === "fixture" ? fixtureSource() : openMeteo()),
    geocode: cachedGeocoder(openMeteoGeocoder()),
    llm: llmFromEnv(env),
  };
}

export function productionApp() {
  return createApp(productionDeps(loadEnv()));
}
