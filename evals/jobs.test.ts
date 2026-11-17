import { describe, expect, test } from "bun:test";
import { scripted } from "../server/llm/fake";
import { createLlm } from "../server/llm/llm";
import { today } from "../shared/engine";
import { forModel, MEERA } from "../shared/profile";
import { severeDay } from "../shared/testing";
import { CASES, type Case } from "./cases";
import { overall, replaying, runCase, taped } from "./jobs";

/** A model that gives these replies in turn. */
function model(...replies: string[]) {
  return createLlm({
    provider: scripted(() => replies.shift() ?? new Error("no more replies")),
    models: ["m1"],
    timeoutMs: 1000,
    log: () => {},
    sleep: async () => {},
  });
}

const offline = createLlm({ provider: null, models: [], timeoutMs: 1000, log: () => {} });

function byId(id: string): Case {
  const c = CASES.find((x) => x.id === id);
  if (!c) throw new Error(`no case ${id}`);
  return c;
}

function goodPlan() {
  const { plan } = today(severeDay(forModel(MEERA)));
  return JSON.stringify({
    headline: "Keep the children's air clean today.",
    steps: plan.steps.map(({ actionId, time, who }) => ({
      actionId,
      time,
      who,
      reason: "The air is kindest then.",
    })),
  });
}

describe("eval cases", () => {
  test("have unique ids and cover every job in both languages", () => {
    expect(new Set(CASES.map((c) => c.id)).size).toBe(CASES.length);
    for (const job of ["plan", "chat", "advisory"]) {
      for (const lang of ["en", "hi"]) {
        expect(CASES.some((c) => c.job === job && c.lang === lang)).toBe(true);
      }
    }
  });
});

describe("runCase", () => {
  test("gives a plan that passes on the first try full marks", async () => {
    const outcome = await runCase(model(goodPlan()), byId("plan-meera-severe-en"));
    expect(outcome).toMatchObject({ status: "scored", model: "m1", score: 1 });
  });

  test("scores a plan the checker rejects twice as zero", async () => {
    const outcome = await runCase(model("not json", "still not"), byId("plan-meera-severe-en"));
    expect(outcome).toMatchObject({ status: "scored", model: "rejected", score: 0 });
  });

  test("checks a chat answer for its card, language and length", async () => {
    const good = await runCase(
      model("Keep them indoors this afternoon and play a quiet game. [K:mask-fit]"),
      byId("chat-play"),
    );
    expect(good).toMatchObject({ status: "scored", score: 1 });

    const english = await runCase(model("Keep them indoors. [K:mask-fit]"), byId("chat-play-hi"));
    if (english.status !== "scored") throw new Error("expected a score");
    expect(english.checks.find((c) => c.name === "language")?.pass).toBe(false);
  });

  test("skips a case when no model can be reached", async () => {
    const outcome = await runCase(offline, byId("chat-play"));
    expect(outcome).toEqual({ id: "chat-play", status: "skipped", reason: "offline" });
    expect(overall([outcome])).toBe(0);
  });

  test("replays a taped run to the same score", async () => {
    const c = byId("plan-meera-severe-en");
    const tape: string[] = [];
    const live = await runCase(taped(model("not json", goodPlan()), tape), c);
    expect(tape).toHaveLength(2);
    const again = await runCase(replaying(tape, "m1"), c);
    expect(again).toEqual(live);
    expect(live).toMatchObject({ status: "scored", score: 0.75 });
  });
});
