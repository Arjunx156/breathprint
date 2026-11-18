import { describe, expect, test } from "bun:test";
import { defaultProfile, forModel, MEERA } from "../../shared/profile";
import { cleanDay, severeDay } from "../../shared/testing";
import { chatRequest, indoorStep } from "./chat";
import { airFacts } from "./grounding";

describe("air facts", () => {
  test("say which day each clean window falls on", () => {
    const days = airFacts(severeDay(forModel(MEERA))).cleanWindows.map((w) => w.day);
    expect(days).toEqual(["today", "tomorrow"]);
  });

  test("state the engine's call on exercise outdoors, so the model never judges a level", () => {
    expect(airFacts(severeDay(forModel(MEERA))).outdoorExercise).toEqual({
      sensitive: "indoors all day today",
      everyoneElse: "indoors all day today",
    });
    // A poor morning that clears by noon: wait for the window rather than go now.
    expect(airFacts(severeDay(forModel(MEERA), 50)).outdoorExercise).toEqual({
      sensitive: "wait until 12:00 to 17:00 today",
      everyoneElse: "wait until 12:00 to 17:00 today",
    });
    expect(airFacts(cleanDay(forModel(MEERA))).outdoorExercise).toEqual({
      sensitive: "fine now",
      everyoneElse: "fine now",
    });
  });

  test("time airing the house like the plan does, inside the first clean window", () => {
    expect(airFacts(severeDay(forModel(MEERA))).airing).toBe(
      "keep them shut now; open them from 12:00 to 17:00 today",
    );
    expect(airFacts(cleanDay(forModel(MEERA))).airing).toBe(
      "fine now, cleanest from 12:00 to 17:00 today",
    );
    const noon = severeDay(forModel(MEERA));
    const inside = { ...noon, air: { ...noon.air, now: "2026-11-18T13:00" } };
    expect(airFacts(inside).airing).toBe("open now, until 17:00");
  });

  test("speak of everyone when no one is sensitive", () => {
    const adults = forModel(defaultProfile(MEERA.place));
    expect(Object.keys(airFacts(severeDay(adults)).outdoorExercise)).toEqual(["everyone"]);
  });
});

describe("chat rules", () => {
  // A small model blends every example it sees, so it only sees today's.
  const rulesFor = (ctx: ReturnType<typeof severeDay>) =>
    chatRequest(ctx, [{ role: "user", text: "Can Dadi walk?" }], "en").req.system;

  test("carry only the exercise case the engine called today", () => {
    const severe = rulesFor(severeDay(forModel(MEERA)));
    expect(severe).toContain("says indoors all day");
    expect(severe).toContain("For children's play");
    expect(severe).not.toContain("gives hours");

    const clearing = rulesFor(severeDay(forModel(MEERA), 50));
    expect(clearing).toContain("gives hours");
    expect(clearing).not.toContain("says indoors all day");
    expect(clearing).not.toContain("For children's play");

    const clean = rulesFor(cleanDay(forModel(MEERA)));
    expect(clean).not.toContain("gives hours");
    expect(clean).not.toContain("says indoors all day");
  });
});

describe("indoor step", () => {
  const severe = severeDay(forModel(MEERA));

  test("is added on an indoor day when an answer about the outing offers none", () => {
    expect(indoorStep(severe, "Too heavy for a walk today [K:exercise].")).toBe(
      " [A:exercise-indoors]",
    );
    expect(indoorStep(severe, "Keep them in today [K:children-play].")).toBe(" [A:play-indoors]");
  });

  test("is left out when the answer offers one, is about something else, or the day clears", () => {
    expect(indoorStep(severe, "Stay in [K:exercise]. Play inside [A:play-indoors].")).toBe("");
    expect(indoorStep(severe, "Wear an N95 [K:mask-fit].")).toBe("");
    expect(indoorStep(severeDay(forModel(MEERA), 50), "Wait for noon [K:exercise].")).toBe("");
  });
});
