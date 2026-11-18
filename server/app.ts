import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { type RequestIdVariables, requestId } from "hono/request-id";
import type { AirSource } from "./air/source";
import type { Env } from "./env";
import type { Geocoder } from "./geocode";
import type { Llm } from "./llm/llm";
import { apiError, notFound, onError } from "./middleware/errors";
import { sameOrigin, securityHeaders } from "./middleware/guards";
import { accessLog } from "./middleware/log";
import { type ClientIp, rateLimit } from "./middleware/rateLimit";
import { advisoryRoutes } from "./routes/advisory";
import { airRoutes } from "./routes/air";
import { chatRoutes } from "./routes/chat";
import { geocodeRoutes } from "./routes/geocode";
import { planRoutes } from "./routes/plan";
import { MAX_PHOTO_BYTES, scanRoutes } from "./routes/scan";

export type Deps = {
  env: Env;
  air: AirSource;
  geocode: Geocoder;
  llm: Llm;
  /** Each entry says where a visitor's address can be trusted from; see rateLimit.ts. */
  clientIp: ClientIp;
};

/** JSON bodies are a profile and a few chat turns; nothing legitimate is bigger. */
export const JSON_LIMIT = 16 * 1024;
/** A room photo as base64, plus the few fields around it. */
export const PHOTO_LIMIT = Math.ceil((MAX_PHOTO_BYTES * 4) / 3) + 1024;

const limit = (maxSize: number) =>
  bodyLimit({
    maxSize,
    onError: (c) => apiError(c, 413, "too_large", "That request is too large."),
  });
const tooLarge = limit(JSON_LIMIT);
const photoTooLarge = limit(PHOTO_LIMIT);

/**
 * The whole API as one Hono app, shared by the Vercel function, the Bun
 * server and the tests. Dependencies come in so tests never touch the network.
 */
export function createApp({ env, air, geocode, llm, clientIp }: Deps) {
  const app = new Hono<{ Variables: RequestIdVariables }>();
  app.use(requestId({ limitLength: 64 }), accessLog, securityHeaders);
  app.use("/api/*", sameOrigin(env.ALLOWED_ORIGINS), (c, next) =>
    c.req.path === "/api/scan" ? photoTooLarge(c, next) : tooLarge(c, next),
  );
  app.use("/api/*", rateLimit({ name: "all", perMinute: env.RATE_LIMIT_PER_MIN, ip: clientIp }));
  // Model calls spend a small free quota, so they get a tighter limit of their own.
  const ai = rateLimit({ name: "ai", perMinute: env.RATE_LIMIT_AI_PER_MIN, ip: clientIp });
  for (const path of ["/api/plan", "/api/chat", "/api/advisory", "/api/scan"]) app.use(path, ai);
  app.onError(onError);
  app.notFound(notFound);

  return app
    .get("/api/health", (c) =>
      c.json({ status: "ok" as const, provider: env.LLM_PROVIDER, ai: llm.ready, air: air.name }),
    )
    .route("/api/air", airRoutes(air))
    .route("/api/geocode", geocodeRoutes(geocode))
    .route("/api/plan", planRoutes({ llm, air }))
    .route("/api/chat", chatRoutes({ llm, air }))
    .route("/api/advisory", advisoryRoutes({ llm, air }))
    .route("/api/scan", scanRoutes({ llm }));
}

export type AppType = ReturnType<typeof createApp>;
