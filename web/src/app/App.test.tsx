import "../../test/page";
import { describe, expect, spyOn, test } from "bun:test";
import { t } from "@shared/i18n";
import { fireEvent, waitFor } from "@testing-library/react";
import { withPage } from "../../test/dom";
import { renderDemo, renderWith } from "../../test/render";
import { PageBoundary } from "./App";

withPage();
const en = (key: Parameters<typeof t>[1]) => t("en", key);

function Broken(): never {
  throw new Error("chunk failed to load");
}

describe("App", () => {
  test("names the current page in the navigation", async () => {
    const view = renderDemo("/indoors");
    await view.findByRole("heading", { level: 1, name: en("indoors.title") });
    const current = view
      .getByRole("navigation")
      .querySelector('[aria-current="page"]')?.textContent;
    expect(current).toBe(en("nav.indoors"));
  });

  test("a page that can't load says so instead of blanking the app", () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    try {
      const view = renderWith(
        "/",
        <PageBoundary>
          <Broken />
        </PageBoundary>,
      );
      expect(view.getByRole("alert").textContent).toContain(en("ui.pageFailed"));
      expect(view.getByRole("button", { name: en("ui.retry") })).toBeTruthy();
    } finally {
      quiet.mockRestore();
    }
  });

  test("switching to Hindi loads its words and relabels the page", async () => {
    const view = renderDemo("/settings");
    fireEvent.click(await view.findByRole("radio", { name: "हिन्दी" }));
    expect(await view.findByRole("link", { name: t("hi", "nav.today") })).toBeTruthy();
    await waitFor(() => expect(document.documentElement.lang).toBe("hi"));
  });
});
