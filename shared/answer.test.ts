import { describe, expect, test } from "bun:test";
import { blocksOf, cleanText, markers, readAnswer, textsOf } from "./answer";

describe("chat answers", () => {
  test("turns markers into citations and keeps only ids that exist", () => {
    const text =
      "Use a fitted N95 [K:mask-fit]. Walk at 14:00 [A:mask-school-run] [A:made-up]. Fit matters [K:mask-fit] [K:nope].";
    const answer = readAnswer(text);
    expect(answer.cards).toEqual(["mask-fit"]);
    expect(answer.actions).toEqual(["mask-school-run"]);
    expect(answer.blocks).toEqual([
      { kind: "p", line: 0, text: "Use a fitted N95. Walk at 14:00. Fit matters." },
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
      { kind: "p", line: 0, text: "Today:" },
      {
        kind: "list",
        line: 1,
        items: [
          { line: 1, text: "Mask up" },
          { line: 2, text: "Shut windows" },
        ],
      },
      { kind: "p", line: 4, text: "Open them at 14:00." },
    ]);
  });

  test("keeps each block's line as the answer streams in", () => {
    const whole = "Stay in today [K:exercise].\n\n- Mask up\n- Shut windows\n\nAir at 14:00.";
    const lines = (text: string) => readAnswer(text).blocks.map((b) => b.line);
    const final = lines(whole);
    for (let end = 1; end <= whole.length; end++) {
      const sofar = lines(whole.slice(0, end));
      expect(sofar).toEqual(final.slice(0, sofar.length));
    }
  });

  test("lays every block's text flat, lists included", () => {
    expect(textsOf(blocksOf("Today:\n- Mask up\n- Shut windows\n\nOpen them at 14:00."))).toEqual([
      "Today:",
      "Mask up",
      "Shut windows",
      "Open them at 14:00.",
    ]);
  });

  test("reads a known id cited without its K: or A:", () => {
    const answer = readAnswer(
      "Call 112 now [see-a-doctor]. Keep them in [play-indoors]. Air at 14:00 [:airing].",
    );
    expect(answer.blocks).toEqual([
      { kind: "p", line: 0, text: "Call 112 now. Keep them in. Air at 14:00." },
    ]);
    expect(answer.cards).toEqual(["see-a-doctor", "airing"]);
    expect(answer.actions).toEqual(["play-indoors"]);
    expect(cleanText("See note [1] and [made-up-id].")).toBe("See note [1] and [made-up-id].");
    expect(cleanText("Not a day for play outside [air].")).toBe("Not a day for play outside.");
    expect(cleanText("घर में खेलें [K:children-play], [A:play-indoors]।")).toBe("घर में खेलें।");
  });

  test("drops a bullet that held only a marker", () => {
    expect(
      readAnswer("Exercise indoors today [K:exercise].\n\n- [A:exercise-indoors]").blocks,
    ).toEqual([{ kind: "p", line: 0, text: "Exercise indoors today." }]);
  });

  test("turns a stray ideographic full stop into the script's own", () => {
    expect(cleanText("बाहर न खेलें [K:children-play]。 घर पर खेलें。")).toBe("बाहर न खेलें। घर पर खेलें।");
    expect(cleanText("Play inside today。")).toBe("Play inside today.");
  });

  test("leaves Hindi untouched", () => {
    const text = "बच्चे आज घर के अंदर खेलें [A:play-indoors]।";
    expect(readAnswer(text).blocks).toEqual([{ kind: "p", line: 0, text: "बच्चे आज घर के अंदर खेलें।" }]);
  });
});
