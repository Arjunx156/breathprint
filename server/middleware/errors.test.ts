import { afterEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { type Fields, type Level, redirectLogs } from "../log";
import { notFound, onError } from "./errors";

/** A bare app that throws `err` on every request, with the real error handlers. */
function throwing(err: Error) {
  const app = new Hono();
  app.get("/boom", () => {
    throw err;
  });
  app.onError(onError);
  app.notFound(notFound);
  return app;
}

let restore: () => void = () => undefined;
afterEach(() => restore());

function captureLogs() {
  const lines: { level: Level; fields: Fields }[] = [];
  restore = redirectLogs((level, fields) => lines.push({ level, fields }));
  return lines;
}

describe("error handler", () => {
  test("a refusal from Hono keeps its status and gets the matching code", async () => {
    const res = await throwing(new HTTPException(413, { message: "Too big." })).request("/boom");
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ error: { code: "too_large", message: "Too big." } });
  });

  test("a refusal with no words and an unlisted status still says something useful", async () => {
    const res = await throwing(new HTTPException(405)).request("/boom");
    expect(res.status).toBe(405);
    expect(await res.json()).toMatchObject({
      error: { code: "bad_request", message: "Request refused." },
    });
  });

  test("an unexpected failure is logged once and tells the visitor nothing of its insides", async () => {
    const lines = captureLogs();
    const res = await throwing(new TypeError("cannot read secret of undefined")).request("/boom");
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).not.toContain("secret");
    expect(JSON.parse(body)).toMatchObject({ error: { code: "internal" } });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: "error", fields: { error: "TypeError" } });
  });

  test("an unknown address gets the same envelope", async () => {
    const res = await throwing(new Error("unused")).request("/nowhere");
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: "not_found", requestId: "" } });
  });
});
