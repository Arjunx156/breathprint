import { describe, expect, spyOn, test } from "bun:test";
import { type Fields, type Level, logger, redirectLogs, toConsole } from "./log";

describe("server log", () => {
  test("writes one JSON line per event, errors and warnings to stderr", () => {
    const info = spyOn(console, "info").mockImplementation(() => undefined);
    const warn = spyOn(console, "warn").mockImplementation(() => undefined);
    const error = spyOn(console, "error").mockImplementation(() => undefined);
    try {
      toConsole("info", { id: "a", status: 200 });
      toConsole("warn", { id: "b", model: "quota" });
      toConsole("error", { id: "c", error: "TypeError" });
      expect(JSON.parse(String(info.mock.calls[0]?.[0]))).toEqual({
        level: "info",
        id: "a",
        status: 200,
      });
      expect(JSON.parse(String(warn.mock.calls[0]?.[0])).level).toBe("warn");
      expect(JSON.parse(String(error.mock.calls[0]?.[0])).error).toBe("TypeError");
    } finally {
      info.mockRestore();
      warn.mockRestore();
      error.mockRestore();
    }
  });

  test("a redirect catches every level until it is undone", () => {
    const seen: [Level, Fields][] = [];
    const restore = redirectLogs((level, fields) => seen.push([level, fields]));
    logger.info({ n: 1 });
    logger.warn({ n: 2 });
    logger.error({ n: 3 });
    restore();
    const after = redirectLogs(() => undefined);
    logger.info({ n: 4 });
    after();
    expect(seen).toEqual([
      ["info", { n: 1 }],
      ["warn", { n: 2 }],
      ["error", { n: 3 }],
    ]);
  });
});
