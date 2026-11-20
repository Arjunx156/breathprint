/*
 * The page's one Trusted Types policy. The CSP (server/headers.ts) makes the
 * browser refuse a plain string at any script sink, and lets no other policy
 * exist, so the only script URL this page can ever hand over is the worker's.
 */

/** The one policy the CSP allows. */
export const POLICY_NAME = "breathprint";
/** The one script URL the policy allows. */
export const WORKER_URL = "/sw.js";

type Rules = { createScriptURL(url: string): string };
/** The slice of the browser's TrustedTypePolicyFactory this page uses. */
export type TrustedTypes = { createPolicy(name: string, rules: Rules): Rules };

declare global {
  /** Present where the browser supports Trusted Types; TypeScript's DOM types leave it out. */
  var trustedTypes: TrustedTypes | undefined;
}

function onlyTheWorker(url: string): string {
  if (url !== WORKER_URL) throw new TypeError(`Breathprint loads no script from ${url}`);
  return url;
}

/**
 * The worker's URL as the browser wants it: a TrustedScriptURL where Trusted
 * Types exist, which register() accepts wherever it takes a string; the plain
 * string elsewhere.
 */
export function workerUrl(factory = globalThis.trustedTypes): string {
  if (!factory) return WORKER_URL;
  const policy = factory.createPolicy(POLICY_NAME, { createScriptURL: onlyTheWorker });
  return policy.createScriptURL(WORKER_URL);
}
