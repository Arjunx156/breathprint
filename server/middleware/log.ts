import type { MiddlewareHandler } from "hono";
import { logger } from "../log";

/**
 * One line per request: id, method, path, status and time. Never the query,
 * body or address, so logs hold nothing personal.
 */
export const accessLog: MiddlewareHandler = async (c, next) => {
  const start = performance.now();
  await next();
  logger.info({
    id: c.get("requestId"),
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    ms: Math.round(performance.now() - start),
  });
};
