import { existsSync } from "node:fs";
import { NOT_FOUND_FILE, PAGES, pageFile } from "@shared/pages";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { loadEnv } from "./env";
import { IMMUTABLE } from "./headers";
import { logger } from "./log";
import { productionApp } from "./main";
import { notFound } from "./middleware/errors";
import { fromHeader } from "./middleware/rateLimit";
import { fromSocket } from "./socket";

const STATIC_ROOT = "./dist/public";

const env = loadEnv();
// Facing the internet directly, the socket is the only address nobody can forge.
const clientIp = env.TRUSTED_IP_HEADER ? fromHeader(env.TRUSTED_IP_HEADER) : fromSocket;

/**
 * The Bun entry for local production runs, Docker and Cloud Run: the API plus
 * the built app: each page's own HTML, and the lost page's with a 404 for the rest.
 */
const app = new Hono().route("/", productionApp(env, clientIp));

if (existsSync(STATIC_ROOT)) {
  app.use("/assets/*", async (c, next) => {
    await next();
    if (c.res.ok) c.res.headers.set("Cache-Control", IMMUTABLE);
  });
  app.use("*", serveStatic({ root: STATIC_ROOT }));
  for (const { path } of PAGES) {
    app.get(path, serveStatic({ path: `${STATIC_ROOT}/${pageFile(path)}` }));
  }
  const lost = serveStatic({
    path: `${STATIC_ROOT}/${NOT_FOUND_FILE}`,
    onFound: (_path, c) => c.status(404),
  });
  // An unknown API address still gets the API's own JSON 404, as it does on Vercel.
  app.get("*", (c, next) => (c.req.path.startsWith("/api/") ? next() : lost(c, next)));
}
app.notFound(notFound);

Bun.serve({ port: env.PORT, fetch: app.fetch });
logger.info({ message: `Breathprint on http://localhost:${env.PORT}` });
