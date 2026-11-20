import type { Place } from "@shared/profile";
import { DAY_MS } from "@shared/time";
import { fixtureSource } from "./air/fixture";
import { openMeteo } from "./air/openMeteo";
import { cached } from "./air/source";
import { createApp, type Deps } from "./app";
import { TtlCache } from "./cache";
import type { Env } from "./env";
import type { Geocoder } from "./geocode";
import { openMeteoGeocoder } from "./geocode";
import { llmFromEnv } from "./llm/config";
import type { ClientIp } from "./middleware/rateLimit";

function cachedGeocoder(geocode: Geocoder): Geocoder {
  const cache = new TtlCache<Place[]>(DAY_MS, 2000);
  return (query, lang) =>
    cache.getOrLoad(`${lang}:${query.toLowerCase()}`, () => geocode(query, lang));
}

/** Production wiring: real upstreams behind caches, chosen by configuration. */
function productionDeps(env: Env, clientIp: ClientIp): Deps {
  return {
    env,
    air: cached(env.AIR_SOURCE === "fixture" ? fixtureSource() : openMeteo()),
    geocode: cachedGeocoder(openMeteoGeocoder()),
    llm: llmFromEnv(env),
    clientIp,
  };
}

/** The app wired to the real forecast, geocoder and model. */
export function productionApp(env: Env, clientIp: ClientIp) {
  return createApp(productionDeps(env, clientIp));
}
