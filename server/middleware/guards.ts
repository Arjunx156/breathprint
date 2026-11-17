import type { Context, MiddlewareHandler } from "hono";
import { SECURITY_HEADERS } from "../headers";
import { apiError } from "./errors";

/** Security headers on every response, and no caching unless a route opts in. */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) c.res.headers.set(name, value);
  if (!c.res.headers.has("Cache-Control")) c.res.headers.set("Cache-Control", "no-store");
};

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Hosts, not origins: TLS ends before the function on Vercel, so the request
 * URL says http:// while the page that sent it is https://.
 */
function sameHost(origin: string, c: Context): boolean {
  if (!URL.canParse(origin)) return false;
  const here = c.req.header("x-forwarded-host") ?? new URL(c.req.url).host;
  return new URL(origin).host === here;
}

/**
 * Writes must come from this site's own pages (or an origin named in
 * ALLOWED_ORIGINS) and carry the content type the route expects. The app
 * sets no cookies, so this is defence in depth against cross-site abuse.
 */
export function sameOrigin(allowed: readonly string[]): MiddlewareHandler {
  return async (c, next) => {
    if (SAFE.has(c.req.method)) return next();
    const origin = c.req.header("origin");
    if (!origin || !(sameHost(origin, c) || allowed.includes(origin))) {
      return apiError(c, 403, "forbidden", "Requests must come from the Breathprint app.");
    }
    const type = c.req.header("content-type") ?? "";
    if (!type.startsWith("application/json") && !type.startsWith("multipart/form-data")) {
      return apiError(c, 400, "bad_request", "Send JSON or a form upload.");
    }
    return next();
  };
}
