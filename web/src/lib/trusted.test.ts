import { describe, expect, test } from "bun:test";
import { CONTENT_SECURITY_POLICY } from "@server/headers";
import { POLICY_NAME, type TrustedTypes, WORKER_URL, workerUrl } from "./trusted";

/** Records the policy the page makes, and wraps what it vouches for. */
function factory() {
  const made: { name: string; vouch: (url: string) => string }[] = [];
  const tt: TrustedTypes = {
    createPolicy(name, rules) {
      made.push({ name, vouch: rules.createScriptURL });
      return { createScriptURL: (url) => `trusted:${rules.createScriptURL(url)}` };
    },
  };
  return { tt, made };
}

describe("trusted types", () => {
  test("the worker's URL goes through the one policy the CSP allows", () => {
    const { tt, made } = factory();
    expect(workerUrl(tt)).toBe(`trusted:${WORKER_URL}`);
    expect(made.map((p) => p.name)).toEqual([POLICY_NAME]);
    expect(CONTENT_SECURITY_POLICY).toContain(`trusted-types ${POLICY_NAME}`);
    expect(CONTENT_SECURITY_POLICY).toContain("require-trusted-types-for 'script'");
  });

  test("the policy vouches for nothing but the worker", () => {
    const { tt, made } = factory();
    workerUrl(tt);
    const vouch = made[0]?.vouch ?? (() => "");
    expect(() => vouch("https://evil.example/x.js")).toThrow(TypeError);
    expect(() => vouch("/assets/other.js")).toThrow(TypeError);
  });

  test("a browser without Trusted Types gets the plain URL", () => {
    expect(workerUrl(undefined)).toBe(WORKER_URL);
  });
});
