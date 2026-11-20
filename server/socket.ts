import type { Context } from "hono";
import { getConnInfo } from "hono/bun";
import type { ClientIp } from "./middleware/rateLimit";

/** The connection behind a request, or null when not running under Bun.serve. */
function connection(c: Context) {
  try {
    return getConnInfo(c);
  } catch {
    // getConnInfo throws outside Bun.serve: in tests, and on Vercel.
    return null;
  }
}

/**
 * The TCP peer's address, for a Bun server that faces the internet itself.
 * Nothing in the request can change it, unlike a forwarding header.
 */
export const fromSocket: ClientIp = (c) => connection(c)?.remote.address;
