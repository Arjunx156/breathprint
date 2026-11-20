import { createHash, randomBytes } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { DAY_MS, MINUTE_MS, SECOND_MS } from "../../shared/time";
import { apiError } from "./errors";

type Window = { count: number; resetAt: number };

/** Where a fixed window's counters live; in memory by default, swappable for a shared store. */
export type RateLimitStore = {
  hit(key: string, windowMs: number, now: number): Window;
};

/** Drops finished windows, then the oldest live ones, until the map fits again. */
function prune(windows: Map<string, Window>, maxKeys: number, now: number) {
  for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
  for (const k of windows.keys()) {
    if (windows.size <= maxKeys) return;
    windows.delete(k);
  }
}

/** Counters in this instance's memory, never more than `maxKeys` of them however many visit. */
export function memoryStore(maxKeys = 10_000): RateLimitStore {
  const windows = new Map<string, Window>();
  return {
    hit(key, windowMs, now) {
      const current = windows.get(key);
      const window =
        current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };
      window.count += 1;
      windows.set(key, window);
      if (windows.size > maxKeys) prune(windows, maxKeys, now);
      return window;
    },
  };
}

/**
 * Where a visitor's address comes from. Only a source the deployment controls
 * counts: a client that could name its own address could dodge every limit.
 */
export type ClientIp = (c: Context) => string | undefined;

/** A header the platform in front writes over whatever the client sent; on Vercel, x-real-ip. */
export function fromHeader(name: string): ClientIp {
  return (c) => c.req.header(name)?.split(",")[0]?.trim() || undefined;
}

/**
 * Addresses are never stored as they are: each is hashed with a salt that
 * changes every day, so counters cannot be joined into a history.
 */
export function ipHasher(now: () => number = Date.now): (ip: string) => string {
  let day = -1;
  let salt = "";
  return (ip) => {
    const today = Math.floor(now() / DAY_MS);
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
  ip: ClientIp;
  store?: RateLimitStore;
  hash?: (ip: string) => string;
  now?: () => number;
};

/**
 * A per-visitor fixed-window limit that answers with the standard RateLimit
 * headers. Visitors whose address is unknown share one window, so a missing
 * address can only ever mean less, never more.
 */
export function rateLimit({
  name,
  perMinute,
  ip,
  store = memoryStore(),
  hash = ipHasher(),
  now = Date.now,
}: Options): MiddlewareHandler {
  return async (c, next) => {
    const t = now();
    const window = store.hit(`${name}:${hash(ip(c) ?? "unknown")}`, MINUTE_MS, t);
    const resetSeconds = Math.max(1, Math.ceil((window.resetAt - t) / SECOND_MS));
    c.header("RateLimit-Limit", String(perMinute));
    c.header("RateLimit-Remaining", String(Math.max(0, perMinute - window.count)));
    c.header("RateLimit-Reset", String(resetSeconds));
    if (window.count > perMinute) {
      c.header("Retry-After", String(resetSeconds));
      return apiError(c, 429, "rate_limited", "Too many requests. Try again in a minute.");
    }
    return next();
  };
}
