import type { LlmRequest } from "./types";

/*
 * A stand-in for fetch, so the adapter tests see exactly what each provider
 * sends and never touch the network.
 */

const real = globalThis.fetch;

/** Puts the real fetch back; each adapter test file runs this after every test. */
export const restoreFetch = () => {
  globalThis.fetch = real;
};

export type Sent = { url: string; body: Record<string, unknown> };

/** Answers every request with `respond()` and keeps what was sent. */
export function serve(respond: () => Response): Sent[] {
  const sent: Sent[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    const raw = input instanceof Request ? await input.text() : String(init?.body ?? "{}");
    sent.push({ url, body: JSON.parse(raw) });
    return respond();
  }) as typeof fetch;
  return sent;
}

/** A scan request: one photo, a schema, and the words after it. */
export const PHOTO: LlmRequest = {
  job: "scan",
  system: "List what you can see.",
  turns: [
    {
      role: "user",
      text: "List what you can see.",
      images: [{ mime: "image/jpeg", data: "AAAA" }],
    },
  ],
  schema: { type: "object" },
  maxTokens: 600,
  temperature: 0.2,
};

const { schema: _schema, ...plain } = PHOTO;
/** The same request as plain text, with no schema. */
export const TEXT: LlmRequest = plain;

export const signal = () => new AbortController().signal;
