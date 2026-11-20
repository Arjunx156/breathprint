import { describe, expect, test } from "bun:test";
import { MEERA } from "../../shared/profile";
import { loadEnv } from "../env";
import { post, testApp, withModel } from "../testing";

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
    const res = await post(testApp(), "/api/advisory", hindiNotice);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ model: "recorded", recorded: true });
  });

  test("model routes have their own, tighter limit", async () => {
    const env = loadEnv({ RATE_LIMIT_AI_PER_MIN: "2" });
    const { app } = withModel([JSON.stringify(advisory)], env);
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++)
      statuses.push((await post(app, "/api/advisory", body, "198.51.100.7")).status);
    expect(statuses).toEqual([200, 200, 429]);
  });
});
