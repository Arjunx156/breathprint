import { describe, expect, test } from "bun:test";
import { clockIn, localDay, weekdayShort } from "./format";

describe("format", () => {
  test("a forecast hour reads as the place's own day, whatever the viewer's zone", () => {
    // 23:00 in Delhi is already the next day in UTC+, the day before in UTC-; neither may leak in.
    expect(localDay("2026-11-18T23:00", "en")).toContain("Wednesday");
    expect(localDay("2026-11-18T23:00", "en")).toContain("18 November");
    expect(weekdayShort("2026-11-19T00:00", "en")).toBe("Thu");
  });

  test("Hindi readers get Hindi day names", () => {
    expect(localDay("2026-11-18T08:00", "hi")).toContain("बुधवार");
  });

  test("an instant shows on the place's clock", () => {
    expect(clockIn("2026-11-18T03:00:00Z", "Asia/Kolkata")).toBe("08:30");
  });

  test("an unknown zone from upstream falls back to a clock rather than throwing", () => {
    expect(clockIn("2026-11-18T03:00:00Z", "Mars/Olympus_Mons")).toMatch(/^\d{2}:\d{2}$/);
  });
});
