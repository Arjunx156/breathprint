import "../../../test/page";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { t } from "@shared/i18n";
import { MEERA, ProfileSchema } from "@shared/profile";
import { fireEvent, within } from "@testing-library/react";
import { withPage } from "../../../test/dom";
import { renderDemo, renderWith, stubFetch } from "../../../test/render";
import { App } from "../../app/App";
import { KEYS, load, save } from "../../lib/storage";

withPage();
const en = (key: Parameters<typeof t>[1]) => t("en", key);

// Settings asks nothing of the network; anything that tries gets a refusal.
let restore: () => void = () => undefined;
beforeEach(() => {
  restore = stubFetch(async () => new Response(null, { status: 503 }));
});
afterEach(() => restore());

function saved() {
  save(KEYS.profile, { ...MEERA, ai: false });
  return renderWith("/settings", <App />);
}

describe("Settings", () => {
  test("a changed scale is kept on this device", async () => {
    const view = saved();
    fireEvent.click(await view.findByRole("radio", { name: en("scale.US") }));
    expect(load(KEYS.profile, ProfileSchema)?.scale).toBe("US");
  });

  test("what the assistant knows carries no one's name", async () => {
    const view = saved();
    const known = (await view.findByRole("heading", { name: en("settings.knows") })).parentElement;
    const shown = known?.querySelector("pre")?.textContent ?? "";
    const names = MEERA.members.flatMap((m) => (m.name ? [m.name] : []));
    expect(names.length).toBeGreaterThan(0);
    expect(shown).toContain('"lat": 28.7');
    for (const name of names) expect(shown).not.toContain(name);
  });

  test("forgetting asks first with focus on the safe answer, and keeping it changes nothing", async () => {
    const view = saved();
    fireEvent.click(await view.findByRole("button", { name: en("settings.forget") }));
    expect(view.getByRole("alert").textContent).toContain(en("settings.forgetConfirm"));
    const keep = view.getByRole("button", { name: en("settings.cancel") });
    expect(document.activeElement).toBe(keep);
    fireEvent.click(keep);
    expect(view.queryByRole("alert")).toBeNull();
    expect(document.activeElement).toBe(view.getByRole("button", { name: en("settings.forget") }));
    expect(load(KEYS.profile, ProfileSchema)).not.toBeNull();
  });

  test("forgetting clears the household and starts setup again", async () => {
    save(KEYS.done, { day: "2026-11-18", ids: ["metro"] });
    const view = saved();
    fireEvent.click(await view.findByRole("button", { name: en("settings.forget") }));
    fireEvent.click(view.getByRole("button", { name: en("settings.forgetYes") }));
    expect(await view.findByRole("heading", { name: en("setup.title") })).toBeTruthy();
    expect(localStorage.getItem(KEYS.profile)).toBeNull();
    expect(localStorage.getItem(KEYS.done)).toBeNull();
  });

  test("the demo offers a way out instead of forgetting anything", async () => {
    const view = renderDemo("/settings");
    // The demo banner has its own exit; this is the one on the page.
    const page = within(await view.findByRole("main"));
    fireEvent.click(await page.findByRole("button", { name: en("demo.exit") }));
    expect(sessionStorage.getItem("bp.demo")).toBeNull();
    expect(await view.findByRole("heading", { name: en("setup.title") })).toBeTruthy();
  });
});
