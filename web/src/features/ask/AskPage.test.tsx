import "../../../test/page";
import { describe, expect, test } from "bun:test";
import { t } from "@shared/i18n";
import { act, cleanup, fireEvent } from "@testing-library/react";
import { withPage } from "../../../test/dom";
import { renderDemo, stubFetch } from "../../../test/render";
import { clearSpeech, FakeRecognizer, fakeRecognition, fakeSynthesis } from "../../../test/speech";

withPage();
const en = (key: Parameters<typeof t>[1]) => t("en", key);

/** An NDJSON chat reply, delivered in the pieces given. */
function stream(...pieces: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(c) {
        for (const p of pieces) c.enqueue(encoder.encode(p));
        c.close();
      },
    }),
    { headers: { "content-type": "application/x-ndjson" } },
  );
}

const line = (event: unknown) => `${JSON.stringify(event)}\n`;

describe("Ask", () => {
  test("streams an answer, turns its markers into sources and steps, and offers to read it", async () => {
    const done = line({ type: "done", model: "gemini-test", recorded: false, flags: [] });
    const restore = stubFetch(async () =>
      stream(
        line({ type: "text", text: "An N95 that seals beats a cloth mask " }),
        // A marker split across two network chunks still lands whole.
        `${line({ type: "text", text: "[K:mask-fit]. Run the purifier tonight [A:pur" }).slice(0, -1)}`,
        `\n${line({ type: "text", text: "ifier-night]." })}${done}`,
      ),
    );
    try {
      const view = renderDemo("/ask");
      fireEvent.change(await view.findByRole("textbox", { name: en("ask.label") }), {
        target: { value: "Which mask for the school run?" },
      });
      fireEvent.click(view.getByRole("button", { name: en("ask.submit") }));

      expect(await view.findByText(/An N95 that seals beats a cloth mask\./)).toBeTruthy();
      expect(view.queryByText(/\[K:/)).toBeNull();
      expect(view.getByRole("heading", { name: en("ask.sources") })).toBeTruthy();
      expect(view.getByText("Which mask works against smog")).toBeTruthy();
      expect(view.getByRole("link", { name: en("action.purifier-night.title") })).toBeTruthy();
    } finally {
      restore();
    }
  });

  test("Enter asks and Shift+Enter doesn't; a listed answer shows as a list", async () => {
    let calls = 0;
    const restore = stubFetch(async () => {
      calls++;
      return stream(
        line({ type: "text", text: "Today:\n- Mask up\n- Shut the windows" }),
        line({ type: "done", model: "gemini-test", recorded: false, flags: [] }),
      );
    });
    try {
      const view = renderDemo("/ask");
      const box = await view.findByRole("textbox", { name: en("ask.label") });
      fireEvent.change(box, { target: { value: "What should we do today?" } });
      fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
      expect(calls).toBe(0);

      fireEvent.keyDown(box, { key: "Enter" });
      expect((await view.findByText("Shut the windows")).tagName).toBe("LI");
      expect(view.getByText("Mask up").tagName).toBe("LI");
      expect(calls).toBe(1);
    } finally {
      restore();
    }
  });

  test("a spoken question fills the box, a blocked microphone says why, and the answer reads aloud", async () => {
    fakeRecognition();
    const spoken = fakeSynthesis();
    const restore = stubFetch(async () =>
      stream(
        line({ type: "text", text: "Keep the children in until two." }),
        line({ type: "done", model: "gemini-test", recorded: false, flags: [] }),
      ),
    );
    try {
      const view = renderDemo("/ask");
      fireEvent.click(await view.findByRole("button", { name: en("ask.speak") }));
      expect(view.getByText(en("ask.listening"))).toBeTruthy();
      act(() =>
        FakeRecognizer.last?.onresult?.({ results: [[{ transcript: "Can they play outside?" }]] }),
      );
      const box = view.getByRole("textbox", { name: en("ask.label") }) as HTMLTextAreaElement;
      expect(box.value).toBe("Can they play outside?");
      act(() => {
        FakeRecognizer.last?.onerror?.({ error: "not-allowed" });
        FakeRecognizer.last?.onend?.();
      });
      expect(view.getByText(en("ask.voice.blocked"))).toBeTruthy();
      expect(view.getByRole("button", { name: en("ask.speak") })).toBeTruthy();

      fireEvent.click(view.getByRole("button", { name: en("ask.submit") }));
      fireEvent.click(await view.findByRole("button", { name: en("ask.read") }));
      expect(spoken.map((u) => u.text)).toEqual(["Keep the children in until two."]);
      fireEvent.click(view.getByRole("button", { name: en("ask.stopReading") }));
      expect(spoken).toEqual([]);
    } finally {
      restore();
      // Unmount while the fakes still exist; the page cancels speech as it goes.
      cleanup();
      clearSpeech();
    }
  });

  test("with no model and no network, Breathprint's own notes answer", async () => {
    const restore = stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    try {
      const view = renderDemo("/ask");
      fireEvent.click(await view.findByRole("button", { name: en("ask.q2") }));
      expect(await view.findByText(en("ask.offline"))).toBeTruthy();
      expect(view.getByRole("heading", { name: "Which mask works against smog" })).toBeTruthy();
    } finally {
      restore();
    }
  });
});
