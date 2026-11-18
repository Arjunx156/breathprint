import "../../../test/page";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { t } from "@shared/i18n";
import { fireEvent, within } from "@testing-library/react";
import { withPage } from "../../../test/dom";
import { renderDemo, stubFetch } from "../../../test/render";

withPage();
const en = (key: Parameters<typeof t>[1]) => t("en", key);

// Gemini is down for every test here: the engine's plan has to carry the page alone.
let restore: () => void = () => undefined;
beforeEach(() => {
  restore = stubFetch(async () =>
    Response.json(
      { error: { code: "model_unavailable", message: "No model answered.", requestId: "t" } },
      { status: 503 },
    ),
  );
});
afterEach(() => restore());

describe("Today", () => {
  test("shows the air, the plan and the breathprint with no model behind it", async () => {
    const view = renderDemo("/");
    const headline = await view.findByRole("heading", { level: 1 });
    expect(headline.textContent?.trim()).not.toBe("");
    expect(view.getByRole("heading", { name: en("plan.title") })).toBeTruthy();
    expect(view.getByRole("heading", { name: en("ledger.title") })).toBeTruthy();
    expect(view.getAllByRole("checkbox").length).toBeGreaterThan(2);
  });

  test("a step's numbers open with the working behind them", async () => {
    const view = renderDemo("/");
    const open = (await view.findAllByRole("button", { name: en("plan.numbers") }))[0];
    if (!open) throw new Error("no step to open");
    fireEvent.click(open);
    const hide = view.getByRole("button", { name: en("plan.hideNumbers") });
    expect(hide.getAttribute("aria-expanded")).toBe("true");
    const panel = document.getElementById(hide.getAttribute("aria-controls") ?? "");
    if (!panel) throw new Error("the button controls no panel");
    expect(await within(panel).findByText(en("impact.method"))).toBeTruthy();
  });

  test("marking a step done moves the breathprint, and undoing it moves it back", async () => {
    const view = renderDemo("/");
    const step = (await view.findAllByRole("checkbox"))[0] as HTMLInputElement;
    // The "done so far" figures live in their own announced region.
    const soFar = view.getByText(en("ledger.doneSoFar")).parentElement;
    const before = soFar?.textContent;
    fireEvent.click(step);
    expect(step.checked).toBe(true);
    expect(soFar?.getAttribute("aria-live")).toBe("polite");
    expect(soFar?.textContent).not.toBe(before);
    fireEvent.click(step);
    expect(step.checked).toBe(false);
    expect(soFar?.textContent).toBe(before);
  });

  test("the forecast chart reads as a table, hour by hour, and back again", async () => {
    const view = renderDemo("/");
    const toggle = await view.findByRole("button", { name: en("today.asTable") });
    fireEvent.click(toggle);
    const table = view.getByRole("table");
    const rows = within(table).getAllByRole("row");
    // A header row, then one row per forecast hour, each led by its time.
    expect(rows.length).toBeGreaterThan(24);
    expect(within(table).getAllByRole("rowheader")).toHaveLength(rows.length - 1);
    // The same button changes its words, so focus never has to move.
    expect(toggle.textContent).toBe(en("today.asChart"));
    fireEvent.click(toggle);
    expect(view.queryByRole("table")).toBeNull();
  });

  test("an unknown address has a way home", async () => {
    const view = renderDemo("/no-such-page");
    expect(await view.findByRole("link", { name: en("notFound.home") })).toBeTruthy();
  });
});
