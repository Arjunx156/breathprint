import "../../../test/page";
import { describe, expect, test } from "bun:test";
import { t } from "@shared/i18n";
import { fireEvent } from "@testing-library/react";
import { withPage } from "../../../test/dom";
import { renderDemo, stubFetch } from "../../../test/render";
import { fetchAdvisory } from "./advisory";

withPage();
const en = (key: Parameters<typeof t>[1]) => t("en", key);

const reply = {
  advisory: {
    headline: "Keep the society indoors today",
    situation: "The air is severe until noon.",
    do: ["Mask up outside", "Air rooms only at noon"],
    avoid: ["Burning leaves"],
    sensitive: "Children and elders stay in.",
  },
  collective: null,
  model: "gemini-test",
  recorded: false,
};

describe("Community", () => {
  test("checks the household count first, then swaps in Gemini's rewrite", async () => {
    let calls = 0;
    const restore = stubFetch(async (url) => {
      if (url.includes("/api/advisory")) calls++;
      return Response.json(reply);
    });
    try {
      const view = renderDemo("/community");
      const households = await view.findByRole("spinbutton", { name: en("community.households") });
      const submit = view.getByRole("button", { name: en("community.submit") });

      fireEvent.change(households, { target: { value: "0" } });
      fireEvent.click(submit);
      expect(view.getByText(en("community.householdsInvalid"))).toBeTruthy();
      expect(calls).toBe(0);

      fireEvent.change(households, { target: { value: "120" } });
      expect(view.queryByText(en("community.householdsInvalid"))).toBeNull();
      fireEvent.click(submit);
      expect(await view.findByRole("heading", { name: reply.advisory.headline })).toBeTruthy();
      expect(view.getByText(en("community.written"))).toBeTruthy();
      expect(calls).toBe(1);
    } finally {
      restore();
    }
  });

  test("sends the area rounded to the forecast grid, and no household", async () => {
    let sent: { place?: { lat: number; lon: number }; members?: unknown } = {};
    const restore = stubFetch(async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      return Response.json(reply);
    });
    try {
      await fetchAdvisory(
        {
          audience: "school",
          channel: "notice",
          households: 40,
          lang: "en",
          demo: false,
          place: { name: "Rohini, Delhi", lat: 28.7356, lon: 77.1123, country: "IN" },
        },
        new AbortController().signal,
      );
      expect(sent.place).toMatchObject({ lat: 28.7, lon: 77.1 });
      expect(sent.members).toBeUndefined();
    } finally {
      restore();
    }
  });
});
