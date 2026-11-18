import "../../test/page";
import { afterEach, describe, expect, test } from "bun:test";
import type { Language } from "@shared/profile";
import { act, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { withPage } from "../../test/dom";
import { clearSpeech, FakeRecognizer, fakeRecognition, fakeSynthesis } from "../../test/speech";
import { useDictation, useReadAloud } from "./speech";

withPage();

afterEach(clearSpeech);

function Dictation({ lang }: { lang: Language }) {
  const [text, setText] = useState("");
  const d = useDictation(lang, setText);
  if (!d.supported) return <p>no voice</p>;
  return (
    <div>
      <button type="button" onClick={d.listening ? d.stop : d.start}>
        {d.listening ? "stop" : "speak"}
      </button>
      <output>{text}</output>
      <p>{d.error ?? "ok"}</p>
    </div>
  );
}

describe("useDictation", () => {
  test("hides itself where the browser has no recogniser", () => {
    const view = render(<Dictation lang="en" />);
    expect(view.getByText("no voice")).toBeTruthy();
  });

  test("listens in Indian Hindi and fills the box as words arrive", () => {
    fakeRecognition();
    const view = render(<Dictation lang="hi" />);
    fireEvent.click(view.getByRole("button", { name: "speak" }));
    const r = FakeRecognizer.last;
    expect(r?.started).toBe(true);
    expect(r?.lang).toBe("hi-IN");
    act(() =>
      r?.onresult?.({ results: [[{ transcript: "क्या बच्चे" }], [{ transcript: " बाहर खेलें" }]] }),
    );
    expect(view.getByRole("status").textContent).toBe("क्या बच्चे बाहर खेलें");
    fireEvent.click(view.getByRole("button", { name: "stop" }));
    expect(view.getByRole("button", { name: "speak" })).toBeTruthy();
  });

  test("a blocked microphone and silence get their own messages", () => {
    fakeRecognition();
    const view = render(<Dictation lang="en" />);
    fireEvent.click(view.getByRole("button", { name: "speak" }));
    act(() => {
      FakeRecognizer.last?.onerror?.({ error: "not-allowed" });
      FakeRecognizer.last?.onend?.();
    });
    expect(view.getByText("blocked")).toBeTruthy();

    fireEvent.click(view.getByRole("button", { name: "speak" }));
    expect(view.getByText("ok")).toBeTruthy();
    act(() => {
      FakeRecognizer.last?.onerror?.({ error: "no-speech" });
      FakeRecognizer.last?.onend?.();
    });
    expect(view.getByText("silence")).toBeTruthy();
  });
});

function Reader({ pieces }: { pieces: string[] }) {
  const voice = useReadAloud("hi");
  if (!voice.supported) return <p>no voice</p>;
  const reading = voice.reading === "a";
  return (
    <button type="button" onClick={() => (reading ? voice.stop() : voice.read("a", pieces))}>
      {reading ? "stop" : "read"}
    </button>
  );
}

describe("useReadAloud", () => {
  test("hides itself where the browser can't speak", () => {
    expect(render(<Reader pieces={["x"]} />).getByText("no voice")).toBeTruthy();
  });

  test("speaks one piece at a time in a Hindi voice, then resets", () => {
    const spoken = fakeSynthesis();
    const view = render(<Reader pieces={["पहला वाक्य।", " ", "दूसरा वाक्य।"]} />);
    fireEvent.click(view.getByRole("button", { name: "read" }));
    expect(spoken.map((u) => u.text)).toEqual(["पहला वाक्य।", "दूसरा वाक्य।"]);
    expect(spoken.every((u) => u.lang === "hi-IN")).toBe(true);
    expect(view.getByRole("button", { name: "stop" })).toBeTruthy();
    act(() => spoken.at(-1)?.onend?.());
    expect(view.getByRole("button", { name: "read" })).toBeTruthy();
  });

  test("stop cancels what's queued", () => {
    const spoken = fakeSynthesis();
    const view = render(<Reader pieces={["one", "two"]} />);
    fireEvent.click(view.getByRole("button", { name: "read" }));
    fireEvent.click(view.getByRole("button", { name: "stop" }));
    expect(spoken).toEqual([]);
    expect(view.getByRole("button", { name: "read" })).toBeTruthy();
  });
});
