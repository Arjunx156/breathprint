import { describe, expect, test } from "bun:test";
import { today } from "../../shared/engine";
import { t } from "../../shared/i18n";
import { MEERA } from "../../shared/profile";
import type { ChatEvent } from "../../shared/replies";
import { severeDay } from "../../shared/testing";
import { fixtureSource } from "../air/fixture";
import { createApp } from "../app";
import { loadEnv } from "../env";
import { type Script, scripted } from "../llm/fake";
import { createLlm } from "../llm/llm";
import type { LlmRequest } from "../llm/types";

const places = async () => [];

/** An app whose model answers from `replies` in turn, recording every request. */
function withModel(replies: Array<string | Error>, env = loadEnv({})) {
  const seen: LlmRequest[] = [];
  const script: Script = (req) => {
    seen.push(req);
    return replies.shift() ?? new Error("no more replies");
  };
  const llm = createLlm({
    provider: scripted(script),
    models: ["m1"],
    timeoutMs: 1000,
    log: () => {},
    sleep: async () => {},
  });
  return { app: createApp({ env, air: fixtureSource(), geocode: places, llm }), seen };
}

const post = (
  app: ReturnType<typeof createApp>,
  path: string,
  body: unknown,
  ip = "198.51.100.1",
) =>
  app.request(path, {
    method: "POST",
    headers: { origin: "http://localhost", "content-type": "application/json", "x-real-ip": ip },
    body: JSON.stringify(body),
  });

/** A reply the checker accepts: the rule plan's own steps with plain reasons. */
function goodPlan(
  reason = "The air is kindest then.",
  headline = "Keep the children's air clean today.",
) {
  const { plan } = today(severeDay());
  return JSON.stringify({
    headline,
    steps: plan.steps.map(({ actionId, time, who }) => ({ actionId, time, who, reason })),
  });
}

const hindiPlan = () => goodPlan("तब हवा सबसे साफ़ होती है।", "आज बच्चों की हवा साफ़ रखें।");

const planBody = { profile: MEERA, lang: "en", demo: true };
/** Outside the demo nothing is saved to fall back on. */
const livePlan = { ...planBody, demo: false };

const offlineApp = () =>
  createApp({
    env: loadEnv({}),
    air: fixtureSource(),
    geocode: places,
    llm: createLlm({ provider: null, models: [], timeoutMs: 1000 }),
  });

describe("personal plan", () => {
  test("returns the model's plan once it passes the checks", async () => {
    const { app, seen } = withModel([goodPlan()]);
    const res = await post(app, "/api/plan", planBody);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      plan: { source: string; steps: unknown[] };
      model: string;
    };
    expect(body.plan.source).toBe("ai");
    expect(body.model).toBe("m1");
    expect(body.plan.steps.length).toBeGreaterThan(2);
    expect(seen[0]?.schema).toBeDefined();
  });

  test("never puts a family member's name in a prompt", async () => {
    const { app, seen } = withModel([goodPlan()]);
    await post(app, "/api/plan", planBody);
    const prompt = JSON.stringify(seen);
    for (const m of MEERA.members) expect(prompt).not.toContain(m.name ?? "unnamed");
  });

  test("asks once more with the problems listed, then accepts the fix", async () => {
    const { app, seen } = withModel([goodPlan("This cuts the risk by 80%."), goodPlan()]);
    const res = await post(app, "/api/plan", planBody);
    expect(res.status).toBe(200);
    expect(seen).toHaveLength(2);
    expect(seen[1]?.turns.at(-1)?.text).toContain('"80%" is not in the data');
  });

  test("sends a plan in the wrong language back to be rewritten", async () => {
    const { app, seen } = withModel([goodPlan(), hindiPlan()]);
    const res = await post(app, "/api/plan", { ...livePlan, lang: "hi" });
    expect(res.status).toBe(200);
    expect(seen[1]?.turns.at(-1)?.text).toContain("Write every sentence in simple everyday Hindi");
  });

  test("falls back with a clear error when both answers break the rules", async () => {
    const unsafe = JSON.stringify({
      headline: "Go out.",
      steps: [{ actionId: "seal-gaps", time: "25:00", who: [], reason: "x" }],
    });
    const { app } = withModel([unsafe, unsafe]);
    const res = await post(app, "/api/plan", livePlan);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: { code: "model_unavailable" } });
  });

  test("answers 503 at once when no model is configured", async () => {
    expect((await post(offlineApp(), "/api/plan", livePlan)).status).toBe(503);
  });

  test("in the demo, shows the saved plan, labelled, when the model is out", async () => {
    const res = await post(offlineApp(), "/api/plan", planBody);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ model: "recorded", recorded: true });
  });

  test("rejects a profile that does not parse", async () => {
    const { app } = withModel([]);
    const res = await post(app, "/api/plan", { ...planBody, profile: { ...MEERA, members: [] } });
    expect(res.status).toBe(400);
  });
});

async function events(res: Response): Promise<ChatEvent[]> {
  const text = await res.text();
  return text
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l) as ChatEvent);
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
    const res = await post(offlineApp(), "/api/chat", { ...ask(t("hi", "ask.q1")), lang: "hi" });
    expect(res.status).toBe(200);
    const done = (await events(res)).at(-1);
    expect(done).toEqual({ type: "done", model: "recorded", recorded: true, flags: [] });
  });
});

describe("community advisory", () => {
  const advisory = {
    headline: "Severe air in Rohini today",
    situation: "The air is severe. It is cleanest in the early afternoon.",
    do: [
      "Keep children indoors at break.",
      "Run a fan filter in classrooms.",
      "Share rides to school.",
    ],
    avoid: ["Burning leaves or rubbish.", "Outdoor sports."],
    sensitive: "Children with asthma should keep their inhaler close and stay indoors.",
  };
  const body = {
    lang: "en",
    audience: "school",
    channel: "whatsapp",
    households: 120,
    place: MEERA.place,
    demo: true,
  };

  test("writes the advisory and adds the engine's shared-air figure", async () => {
    const { app } = withModel([JSON.stringify(advisory)]);
    const res = await post(app, "/api/advisory", body);
    expect(res.status).toBe(200);
    const reply = (await res.json()) as { advisory: unknown; collective: { households: number } };
    expect(reply.advisory).toEqual(advisory);
    expect(reply.collective.households).toBe(120);
  });

  test("sends an advisory in the wrong language back to be rewritten", async () => {
    const english = JSON.stringify(advisory);
    const { app, seen } = withModel([english, english]);
    await post(app, "/api/advisory", { ...body, lang: "hi", demo: false });
    expect(seen[1]?.turns.at(-1)?.text).toContain("Write every sentence in simple everyday Hindi");
  });

  test("in the demo, shows the saved advisory, labelled, when the model is out", async () => {
    const hindiNotice = { ...body, lang: "hi", audience: "society", channel: "notice" };
    const res = await post(offlineApp(), "/api/advisory", hindiNotice);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ model: "recorded", recorded: true });
  });

  test("model routes have their own, tighter limit", async () => {
    const env = loadEnv({ RATE_LIMIT_AI_PER_MIN: "2" });
    const { app } = withModel([JSON.stringify(advisory)], env);
    const statuses = [];
    for (let i = 0; i < 3; i++)
      statuses.push((await post(app, "/api/advisory", body, "198.51.100.7")).status);
    expect(statuses).toEqual([200, 200, 429]);
  });
});
