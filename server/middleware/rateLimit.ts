import { createHash, randomBytes } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { apiError } from "./errors";

type Window = { count: number; resetAt: number };

/** Where a fixed window's counters live; in memory by default, swappable for a shared store. */
export type RateLimitStore = {
  hit(key: string, windowMs: number, now: number): Window;
};

export function memoryStore(maxKeys = 10_000): RateLimitStore {
  const windows = new Map<string, Window>();
  return {
    hit(key, windowMs, now) {
      const current = windows.get(key);
      const window =
        current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };
      window.count += 1;
      windows.set(key, window);
      if (windows.size > maxKeys) {
        for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
      }
      return window;
    },
  };
}

/** The client address as the platform reports it; the first hop is the visitor. */
export function clientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  return c.req.header("x-real-ip") ?? forwarded ?? "local";
}

/**
 * Addresses are never stored as they are: each is hashed with a salt that
 * changes every day, so counters cannot be joined into a history.
 */
export function ipHasher(now: () => number = Date.now): (ip: string) => string {
  let day = -1;
  let salt = "";
  return (ip) => {
    const today = Math.floor(now() / 86_400_000);
    if (today !== day) {
      day = today;
      salt = randomBytes(16).toString("hex");
    }
    return createHash("sha256").update(salt).update(ip).digest("base64url").slice(0, 22);
  };
}

type Options = {
  name: string;
  perMinute: number;
  store?: RateLimitStore;
  hash?: (ip: string) => string;
  now?: () => number;
};

/** A per-visitor fixed-window limit that answers with the standard RateLimit headers. */
export function rateLimit({
  name,
  perMinute,
  store = memoryStore(),
  hash = ipHasher(),
  now = Date.now,
}: Options): MiddlewareHandler {
  return async (c, next) => {
    const t = now();
    const window = store.hit(`${name}:${hash(clientIp(c))}`, 60_000, t);
    const resetSeconds = Math.max(1, Math.ceil((window.resetAt - t) / 1000));
    c.header("RateLimit-Limit", String(perMinute));
    c.header("RateLimit-Remaining", String(Math.max(0, perMinute - window.count)));
    c.header("RateLimit-Reset", String(resetSeconds));
    if (window.count > perMinute) {
      c.header("Retry-After", String(resetSeconds));
      return apiError(c, 429, "rate_limited", "Too many requests. Try again in a minute.");
    }
    await next();
  };
}
