import { describe, expect, test } from "bun:test";
import { inTurn, scriptedLlm } from "../server/llm/fake";
import { offlineLlm } from "../server/testing";
import { today } from "../shared/engine";
import { forModel, MEERA } from "../shared/profile";
import { severeDay } from "../shared/testing";
import { CASES, type Case } from "./cases";
import { overall, replaying, runCase, taped } from "./jobs";

/** A model that gives these replies in turn. */
const model = (...replies: string[]) => scriptedLlm(inTurn(replies));

const offline = offlineLlm();

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

  test("on an indoor day, wants the card and the indoor alternative", async () => {
    const good = await runCase(
      model("It is an indoor day. Play a quiet game inside [K:children-play] [A:play-indoors]."),
      byId("chat-play"),
    );
    expect(good).toMatchObject({ status: "scored", score: 1 });

    // Citing the card is enough for the engine to add its own indoor step, as the page does.
    const topped = await runCase(
      model("Keep them indoors today [K:children-play]."),
      byId("chat-play"),
    );
    expect(topped).toMatchObject({ status: "scored", score: 1 });

    const bare = await runCase(model("Keep them indoors today."), byId("chat-play"));
    if (bare.status !== "scored") throw new Error("expected a score");
    expect(bare.checks.find((c) => c.name === "indoor alternative")?.pass).toBe(false);
  });

  test("lets an emergency answer name the danger signs the rules list", async () => {
    const outcome = await runCase(
      model(
        "Call 112 now. Breathlessness, chest pain, wheezing that does not settle, confusion or blue lips need care at once [K:see-a-doctor].",
      ),
      byId("chat-blue-lips"),
    );
    expect(outcome).toMatchObject({ status: "scored", score: 1 });
  });

  test("on a morning that clears, wants the window named", async () => {
    const c = byId("chat-dadi-walk-poor");
    const later = await runCase(model("Not at 7. She can walk between 12:00 and 17:00."), c);
    expect(later).toMatchObject({ status: "scored", score: 1 });

    const noTime = await runCase(model("Not this morning; the air is poor."), c);
    if (noTime.status !== "scored") throw new Error("expected a score");
    expect(noTime.checks.find((x) => x.name === "suggests a time")?.pass).toBe(false);
  });

  test("checks a chat answer's language", async () => {
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
    if (live.status !== "scored") throw new Error("expected a score");
    // Repaired on the second try: that is the only mark lost.
    expect(live.checks.filter((x) => !x.pass).map((x) => x.name)).toEqual(["first try"]);
  });
});
