import { describe, expect, test } from "bun:test";
import { blocksOf, cleanText, markers, readAnswer } from "./answer";

describe("chat answers", () => {
  test("turns markers into citations and keeps only ids that exist", () => {
    const text =
      "Use a fitted N95 [K:mask-fit]. Walk at 14:00 [A:mask-school-run] [A:made-up]. Fit matters [K:mask-fit] [K:nope].";
    const answer = readAnswer(text);
    expect(answer.cards).toEqual(["mask-fit"]);
    expect(answer.actions).toEqual(["mask-school-run"]);
    expect(answer.blocks).toEqual([
      { kind: "p", text: "Use a fitted N95. Walk at 14:00. Fit matters." },
    ]);
  });

  test("lists every cited id, known or not, for the evals", () => {
    expect(markers("a [K:x] b [A:y] c [K:x]")).toEqual({ cards: ["x"], actions: ["y"] });
  });

  test("hides a marker that is still arriving", () => {
    expect(cleanText("Keep the windows shut [K:clo")).toBe("Keep the windows shut");
    expect(cleanText("Keep the windows shut [")).toBe("Keep the windows shut");
    expect(cleanText("Run the purifier **all night**.")).toBe("Run the purifier all night.");
  });

  test("groups dash lines into a list between paragraphs", () => {
    expect(blocksOf("Today:\n- Mask up\n- Shut windows\n\nOpen them at 14:00.")).toEqual([
      { kind: "p", text: "Today:" },
      { kind: "list", items: ["Mask up", "Shut windows"] },
      { kind: "p", text: "Open them at 14:00." },
    ]);
  });

  test("reads a known id cited without its K: or A:", () => {
    const answer = readAnswer("Call 112 now [see-a-doctor]. Keep them in [play-indoors].");
    expect(answer.blocks).toEqual([{ kind: "p", text: "Call 112 now. Keep them in." }]);
    expect(answer.cards).toEqual(["see-a-doctor"]);
    expect(answer.actions).toEqual(["play-indoors"]);
    expect(cleanText("See note [1] and [made-up-id].")).toBe("See note [1] and [made-up-id].");
  });

  test("drops a bullet that held only a marker", () => {
    expect(
      readAnswer("Exercise indoors today [K:exercise].\n\n- [A:exercise-indoors]").blocks,
    ).toEqual([{ kind: "p", text: "Exercise indoors today." }]);
  });

  test("leaves Hindi untouched", () => {
    const text = "बच्चे आज घर के अंदर खेलें [A:play-indoors]।";
    expect(readAnswer(text).blocks).toEqual([{ kind: "p", text: "बच्चे आज घर के अंदर खेलें।" }]);
  });
});
