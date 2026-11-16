import type { Context, ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { $ZodError } from "zod/v4/core";
import { UpstreamError } from "../air/source";

export type ErrorCode =
  | "bad_request"
  | "not_found"
  | "forbidden"
  | "too_large"
  | "rate_limited"
  | "upstream_unavailable"
  | "model_unavailable"
  | "internal";

/** The one error shape every route returns: a code to branch on, words to show, an id to quote. */
export type ApiError = { error: { code: ErrorCode; message: string; requestId: string } };

export function apiError(
  c: Context,
  status: ContentfulStatusCode,
  code: ErrorCode,
  message: string,
) {
  const body: ApiError = { error: { code, message, requestId: c.get("requestId") ?? "" } };
  return c.json(body, status);
}

const BY_STATUS: Partial<Record<number, ErrorCode>> = {
  400: "bad_request",
  403: "forbidden",
  404: "not_found",
  413: "too_large",
  429: "rate_limited",
};

/** Expected failures get a clear answer; anything else is logged once and told apart by id only. */
export const onError: ErrorHandler = (err, c) => {
  // The base class, so schemas from zod/mini (shared with the browser) are caught too.
  if (err instanceof $ZodError) {
    const detail = err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
    return apiError(c, 400, "bad_request", `Invalid request. ${detail}`.slice(0, 300));
  }
  if (err instanceof UpstreamError) {
    console.warn(JSON.stringify({ level: "warn", id: c.get("requestId"), upstream: err.message }));
    return apiError(
      c,
      502,
      "upstream_unavailable",
      "The air data service did not answer. Try again shortly.",
    );
  }
  if (err instanceof HTTPException) {
    const status = err.status as ContentfulStatusCode;
    return apiError(
      c,
      status,
      BY_STATUS[status] ?? "bad_request",
      err.message || "Request refused.",
    );
  }
  console.error(
    JSON.stringify({
      level: "error",
      id: c.get("requestId"),
      error: err.name,
      message: err.message,
    }),
  );
  return apiError(c, 500, "internal", "Something went wrong on our side.");
};

export const notFound: NotFoundHandler = (c) =>
  apiError(c, 404, "not_found", "There is nothing at this address.");
