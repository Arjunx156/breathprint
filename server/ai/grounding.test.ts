import { describe, expect, test } from "bun:test";
import { defaultProfile, forModel, MEERA } from "../../shared/profile";
import { cleanDay, severeDay } from "../../shared/testing";
import { chatRequest } from "./chat";
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
    expect(severe).not.toContain("gives hours");

    const clearing = rulesFor(severeDay(forModel(MEERA), 50));
    expect(clearing).toContain("gives hours");
    expect(clearing).not.toContain("says indoors all day");

    const clean = rulesFor(cleanDay(forModel(MEERA)));
    expect(clean).not.toContain("gives hours");
    expect(clean).not.toContain("says indoors all day");
  });
});
