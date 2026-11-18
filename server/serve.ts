import { existsSync } from "node:fs";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { loadEnv } from "./env";
import { IMMUTABLE } from "./headers";
import { logger } from "./log";
import { productionApp } from "./main";
import { fromHeader } from "./middleware/rateLimit";
import { fromSocket } from "./socket";

const STATIC_ROOT = "./dist/public";

const env = loadEnv();
// Facing the internet directly, the socket is the only address nobody can forge.
const clientIp = env.TRUSTED_IP_HEADER ? fromHeader(env.TRUSTED_IP_HEADER) : fromSocket;

/**
 * The Bun entry for local production runs, Docker and Cloud Run: the API plus
 * the built app, with unknown paths falling back to the single-page shell.
 */
const app = new Hono().route("/", productionApp(env, clientIp));

if (existsSync(STATIC_ROOT)) {
  app.use("/assets/*", async (c, next) => {
    await next();
    if (c.res.ok) c.res.headers.set("Cache-Control", IMMUTABLE);
  });
  app.use("*", serveStatic({ root: STATIC_ROOT }));
  app.get("*", serveStatic({ path: `${STATIC_ROOT}/index.html` }));
}

Bun.serve({ port: env.PORT, fetch: app.fetch });
logger.info({ message: `Breathprint on http://localhost:${env.PORT}` });
