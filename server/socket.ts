import { getConnInfo } from "hono/bun";
import type { ClientIp } from "./middleware/rateLimit";

/**
 * The TCP peer's address, for a Bun server that faces the internet itself.
 * Nothing in the request can change it, unlike a forwarding header.
 */
export const fromSocket: ClientIp = (c) => {
  try {
    return getConnInfo(c).remote.address;
  } catch {
    // Not running under Bun.serve, so there is no socket to ask.
    return undefined;
  }
};
