import { describe, expect, test } from "bun:test";
import { asked, type Exchange, history, step } from "./exchange";

describe("an exchange", () => {
  test("grows with each piece of text, then settles with its flags", () => {
    let x = asked(1, "Can the children play outside?");
    x = step(x, { type: "text", text: "Not today. " });
    x = step(x, { type: "text", text: "Play inside." });
    expect(x.answer).toBe("Not today. Play inside.");
    expect(x.state).toBe("streaming");
    x = step(x, { type: "done", model: "gemini", flags: ["40 kg"], recorded: true });
    expect(x).toMatchObject({ state: "done", flags: ["40 kg"], recorded: true });
  });

  test("breaks on an error and keeps what arrived", () => {
    const x = step({ ...asked(2, "Masks?"), answer: "Wear an N95" }, { type: "error" });
    expect(x).toMatchObject({ state: "broken", answer: "Wear an N95" });
  });

  test("sends earlier answered turns, then the new question", () => {
    const done: Exchange = { ...asked(1, "First?"), answer: "Yes.", state: "done" };
    const empty: Exchange = { ...asked(2, "Lost?"), state: "offline" };
    expect(history([done, empty], "Next?")).toEqual([
      { role: "user", text: "First?" },
      { role: "model", text: "Yes." },
      { role: "user", text: "Next?" },
    ]);
  });
});
