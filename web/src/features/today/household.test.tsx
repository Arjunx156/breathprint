import "../../../test/page";
import { afterEach, describe, expect, test } from "bun:test";
import { AirSnapshotSchema, summarize } from "@shared/air";
import { today } from "@shared/engine";
import { delhiSevereSnapshot } from "@shared/fixtures";
import { t } from "@shared/i18n";
import type { PlanReply } from "@shared/plan";
import { coarse, MEERA, type Profile, ProfileSchema } from "@shared/profile";
import { fireEvent } from "@testing-library/react";
import { withPage } from "../../../test/dom";
import { renderWith, stubFetch } from "../../../test/render";
import { App } from "../../app/App";
import { KEYS, load, save } from "../../lib/storage";

withPage();
const en = (key: Parameters<typeof t>[1], vars?: Parameters<typeof t>[2]) => t("en", key, vars);

// A real household on a real day, not the demo: the forecast has to come over the network.
const snapshot = delhiSevereSnapshot(new Date().toISOString().slice(0, 10));
const cell = KEYS.air(`${coarse(MEERA.place.lat)},${coarse(MEERA.place.lon)}`);

const failing = (status: number, code: string) => () =>
  Response.json({ error: { code, message: "No.", requestId: "t" } }, { status });
const airDown = failing(502, "upstream_unavailable");
const modelDown = failing(503, "model_unavailable");

/** What each API answers; a test swaps an answer to bring a service back. */
type Answers = { air: () => Response; plan: () => Response };

let restore: () => void = () => undefined;
afterEach(() => restore());

function serve(answers: Answers) {
  restore = stubFetch(async (url) => (url.includes("/api/air") ? answers.air() : answers.plan()));
}

function household(ai: boolean) {
  const profile: Profile = { ...MEERA, ai };
  save(KEYS.profile, profile);
  return { profile, view: renderWith("/", <App />) };
}

/** The engine's own plan, relabelled as the model's with a headline of its own. */
function modelReply(profile: Profile): PlanReply {
  const { plan } = today({ profile, air: summarize(snapshot, Date.now()) }, "en");
  return {
    plan: { ...plan, source: "ai", headline: "Gemini's plan for the Rohini household" },
    model: "test-model",
    recorded: false,
  };
}

describe("a saved household", () => {
  test("with the air service down, the plan stands on the forecast saved on this device", async () => {
    save(cell, snapshot);
    serve({ air: airDown, plan: modelDown });
    const { view } = household(false);
    // fetchedAt is 02:30 UTC, which Delhi's clock reads as 08:00.
    expect(await view.findByText(en("air.saved", { time: "08:00" }))).toBeTruthy();
    expect(view.getByRole("heading", { name: en("plan.title") })).toBeTruthy();
  });

  test("with nothing saved either, it says so, and a retry brings the day back and keeps a copy", async () => {
    const answers: Answers = { air: airDown, plan: modelDown };
    serve(answers);
    const { view } = household(false);
    const alert = await view.findByRole("alert");
    expect(alert.textContent).toContain(en("air.error"));

    answers.air = () => Response.json(snapshot);
    fireEvent.click(view.getByRole("button", { name: en("air.retry") }));
    expect(await view.findByRole("heading", { name: en("plan.title") })).toBeTruthy();
    expect(view.queryByText(en("air.saved", { time: "08:00" }))).toBeNull();
    expect(load(cell, AirSnapshotSchema)).toEqual(snapshot);
  });

  test("Gemini is asked only after the family agrees, and its plan shows only when chosen", async () => {
    const answers: Answers = { air: () => Response.json(snapshot), plan: modelDown };
    serve(answers);
    const { profile, view } = household(false);
    const rulesHeadline = (await view.findByRole("heading", { level: 1 })).textContent;

    fireEvent.click(await view.findByRole("button", { name: en("ai.enable") }));
    expect(load(KEYS.profile, ProfileSchema)?.ai).toBe(true);
    // The pressed button is gone; focus stays on the notice that replaced it.
    const notice = document.activeElement;
    expect(notice?.getAttribute("aria-live")).toBe("polite");
    expect(await view.findByText(en("ai.failed"))).toBeTruthy();

    answers.plan = () => Response.json(modelReply({ ...profile, ai: true }));
    fireEvent.click(view.getByRole("button", { name: en("ai.retry") }));
    expect(document.activeElement).toBe(notice);
    const show = await view.findByRole("button", { name: en("ai.show") });
    // Ready, but the rules plan stays until the family asks for the other one.
    expect(view.getByRole("heading", { level: 1 }).textContent).toBe(rulesHeadline);

    fireEvent.click(show);
    expect(view.getByRole("heading", { level: 1 }).textContent).toBe(
      "Gemini's plan for the Rohini household",
    );
    fireEvent.click(view.getByRole("button", { name: en("ai.back") }));
    expect(view.getByRole("heading", { level: 1 }).textContent).toBe(rulesHeadline);
  });
});
