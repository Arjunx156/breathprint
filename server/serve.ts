import { existsSync } from "node:fs";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { loadEnv } from "./env";
import { IMMUTABLE } from "./headers";
import { productionApp } from "./main";

const STATIC_ROOT = "./dist/public";

/**
 * The Bun entry for local production runs, Docker and Cloud Run: the API plus
 * the built app, with unknown paths falling back to the single-page shell.
 */
const app = new Hono().route("/", productionApp());

if (existsSync(STATIC_ROOT)) {
  app.use("/assets/*", async (c, next) => {
    await next();
    if (c.res.ok) c.res.headers.set("Cache-Control", IMMUTABLE);
  });
  app.use("*", serveStatic({ root: STATIC_ROOT }));
  app.get("*", serveStatic({ path: `${STATIC_ROOT}/index.html` }));
}

const { PORT } = loadEnv();
Bun.serve({ port: PORT, fetch: app.fetch });
console.info(JSON.stringify({ level: "info", message: `Breathprint on http://localhost:${PORT}` }));
