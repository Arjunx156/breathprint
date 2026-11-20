import { describe, expect, test } from "bun:test";
import { t } from "../../shared/i18n";
import { MEERA } from "../../shared/profile";
import type { ChatEvent } from "../../shared/replies";
import { post, testApp, withModel } from "../testing";

const planBody = { profile: MEERA, lang: "en", demo: true };

/** The chat stream read back as its events, one JSON object a line. */
async function events(res: Response): Promise<ChatEvent[]> {
  const text = await res.text();
  return text
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as ChatEvent);
}

describe("chat", () => {
  const ask = (text: string) => ({ ...planBody, messages: [{ role: "user", text }] });

  test("streams the answer and flags a figure the data never gave", async () => {
    const reply =
      "Use a fitted N95 for the walk [K:mask-fit] [A:mask-school-run]. It blocks 99% of smoke.";
    const { app, seen } = withModel([reply]);
    const res = await post(app, "/api/chat", ask("Which mask should Kabir wear?"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const all = await events(res);
    const text = all.flatMap((e) => (e.type === "text" ? [e.text] : [])).join("");
    expect(text).toBe(reply);
    expect(all.at(-1)).toEqual({ type: "done", model: "m1", recorded: false, flags: ["99%"] });
    expect(seen[0]?.system).toContain("mask-fit");
    expect(seen[0]?.turns.at(-1)?.text).toStartWith("<question>");
  });

  test("ends an indoor-day answer on the engine's indoor step when the model leaves it out", async () => {
    const reply = "The air is too heavy for a walk today [K:exercise].";
    const { app } = withModel([reply]);
    const all = await events(await post(app, "/api/chat", ask("Can Dadi walk at 7?")));
    const text = all.flatMap((e) => (e.type === "text" ? [e.text] : [])).join("");
    expect(text).toBe(`${reply} [A:exercise-indoors]`);
  });

  test("insists the conversation ends with a question", async () => {
    const { app } = withModel([]);
    const res = await post(app, "/api/chat", {
      ...planBody,
      messages: [{ role: "model", text: "Hello" }],
    });
    expect(res.status).toBe(400);
  });

  test("says the model is out before streaming, so the browser can fall back", async () => {
    const { app } = withModel([new Error("down"), new Error("down")]);
    expect((await post(app, "/api/chat", ask("Can the kids play outside?"))).status).toBe(503);
  });

  test("in the demo, streams the saved answer to a suggested question", async () => {
    const res = await post(testApp(), "/api/chat", { ...ask(t("hi", "ask.q1")), lang: "hi" });
    expect(res.status).toBe(200);
    const done = (await events(res)).at(-1);
    expect(done).toEqual({ type: "done", model: "recorded", recorded: true, flags: [] });
  });
});
