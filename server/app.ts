import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { type RequestIdVariables, requestId } from "hono/request-id";
import type { AirSource } from "./air/source";
import type { Env } from "./env";
import type { Geocoder } from "./geocode";
import { apiError, notFound, onError } from "./middleware/errors";
import { sameOrigin, securityHeaders } from "./middleware/guards";
import { accessLog } from "./middleware/log";
import { rateLimit } from "./middleware/rateLimit";
import { airRoutes } from "./routes/air";
import { geocodeRoutes } from "./routes/geocode";

export type Deps = { env: Env; air: AirSource; geocode: Geocoder };

/** JSON bodies are a profile and a few chat turns; nothing legitimate is bigger. */
export const JSON_LIMIT = 16 * 1024;

const tooLarge = bodyLimit({
  maxSize: JSON_LIMIT,
  onError: (c) => apiError(c, 413, "too_large", "That request is too large."),
});

/**
 * The whole API as one Hono app, shared by the Vercel function, the Bun
 * server and the tests. Dependencies come in so tests never touch the network.
 */
export function createApp({ env, air, geocode }: Deps) {
  const app = new Hono<{ Variables: RequestIdVariables }>();
  app.use(requestId({ limitLength: 64 }), accessLog, securityHeaders);
  app.use("/api/*", sameOrigin(env.ALLOWED_ORIGINS), tooLarge);
  app.use("/api/*", rateLimit({ name: "all", perMinute: env.RATE_LIMIT_PER_MIN }));
  app.onError(onError);
  app.notFound(notFound);

  return app
    .get("/api/health", (c) =>
      c.json({ status: "ok" as const, provider: env.LLM_PROVIDER, air: air.name }),
    )
    .route("/api/air", airRoutes(air))
    .route("/api/geocode", geocodeRoutes(geocode));
}

export type AppType = ReturnType<typeof createApp>;
