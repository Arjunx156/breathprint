import { describe, expect, test } from "bun:test";
import { today } from "@shared/engine";
import { MEERA } from "@shared/profile";
import { severeDay } from "@shared/testing";
import { post, testApp, withModel } from "../testing";

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
    expect((await post(testApp(), "/api/plan", livePlan)).status).toBe(503);
  });

  test("in the demo, shows the saved plan, labelled, when the model is out", async () => {
    const res = await post(testApp(), "/api/plan", planBody);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ model: "recorded", recorded: true });
  });

  test("rejects a profile that does not parse", async () => {
    const { app } = withModel([]);
    const res = await post(app, "/api/plan", { ...planBody, profile: { ...MEERA, members: [] } });
    expect(res.status).toBe(400);
  });
});
