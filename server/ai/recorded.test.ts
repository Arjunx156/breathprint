import { describe, expect, test } from "bun:test";
import { keyOf, liveOrRecorded } from "./recorded";
import type { Parsed } from "./structured";

const down = () => Promise.reject(new Error("model down"));
const up = () => Promise.resolve({ value: "live words", model: "m1" });
/** Accepts anything but the word "stale". */
const read = (text: string): Parsed<string> =>
  text === "stale" ? { ok: false, issues: ["stale"] } : { ok: true, value: text };
const shelf = (text?: string) => () => text;

describe("live or recorded", () => {
  test("a live answer wins and says so", async () => {
    const reply = await liveOrRecorded(up, { demo: true, key: "k", read }, shelf("saved"));
    expect(reply).toEqual({ value: "live words", model: "m1", recorded: false });
  });

  test("in the demo, a failure falls back to the saved answer, labelled", async () => {
    const reply = await liveOrRecorded(down, { demo: true, key: "k", read }, shelf("saved"));
    expect(reply).toEqual({ value: "saved", model: "recorded", recorded: true });
  });

  test("a real household never gets a recording", async () => {
    const asked = liveOrRecorded(down, { demo: false, key: "k", read }, shelf("saved"));
    await expect(asked).rejects.toThrow("model down");
  });

  test("a saved answer that fails today's check is not shown", async () => {
    const stale = liveOrRecorded(down, { demo: true, key: "k", read }, shelf("stale"));
    await expect(stale).rejects.toThrow("model down");
    const missing = liveOrRecorded(down, { demo: true, key: "k", read }, shelf());
    await expect(missing).rejects.toThrow("model down");
  });

  test("keys depend on every part, in order", () => {
    expect(keyOf(["en", 1])).toBe(keyOf(["en", 1]));
    expect(keyOf(["en", 1])).not.toBe(keyOf([1, "en"]));
  });
});
