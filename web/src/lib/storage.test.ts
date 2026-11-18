import "../../test/page";
import { describe, expect, test } from "bun:test";
import { z } from "zod/mini";
import { withPage } from "../../test/dom";
import { KEYS, load, remove, save } from "./storage";

withPage();

const Saved = z.object({ day: z.string(), ids: z.array(z.string()) });

/**
 * Runs `check` with localStorage refusing to be touched at all, the way
 * blocked site data and sandboxed frames do, then gives it back.
 */
function withStorageBlocked(check: () => void) {
  const real = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  if (!real) throw new Error("this page has no localStorage to block");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("The operation is insecure.", "SecurityError");
    },
  });
  try {
    check();
  } finally {
    Object.defineProperty(globalThis, "localStorage", real);
  }
}

describe("storage", () => {
  test("a saved value comes back through its schema", () => {
    save(KEYS.done, { day: "2026-11-18", ids: ["metro"] });
    expect(load(KEYS.done, Saved)).toEqual({ day: "2026-11-18", ids: ["metro"] });
  });

  test("nothing saved, broken JSON and an old shape all read as nothing", () => {
    expect(load(KEYS.done, Saved)).toBeNull();
    localStorage.setItem(KEYS.done, "{not json");
    expect(load(KEYS.done, Saved)).toBeNull();
    localStorage.setItem(KEYS.done, JSON.stringify({ day: 18, ids: "metro" }));
    expect(load(KEYS.done, Saved)).toBeNull();
  });

  test("remove forgets the value", () => {
    save(KEYS.profile, { any: "thing" });
    remove(KEYS.profile);
    expect(localStorage.getItem(KEYS.profile)).toBeNull();
  });

  test("blocked storage never throws into the app", () => {
    withStorageBlocked(() => {
      expect(() => localStorage.setItem("probe", "1")).toThrow("insecure");
      expect(() => save(KEYS.done, { day: "x", ids: [] })).not.toThrow();
      expect(() => remove(KEYS.done)).not.toThrow();
      expect(load(KEYS.done, Saved)).toBeNull();
    });
  });

  test("each grid cell keeps its own forecast", () => {
    expect(KEYS.air("28.7,77.1")).not.toBe(KEYS.air("19.1,72.9"));
  });
});
