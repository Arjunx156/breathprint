import "../../test/page";
import { describe, expect, spyOn, test } from "bun:test";
import { t } from "@shared/i18n";
import { PAGES } from "@shared/pages";
import { fireEvent, waitFor } from "@testing-library/react";
import { withPage } from "../../test/dom";
import { renderDemo, renderWith, stubFetch } from "../../test/render";
import { PageBoundary } from "./PageBoundary";

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
    const quiet = spyOn(console, "error").mockImplementation(() => undefined);
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
    await waitFor(() => expect(document.title).toBe(`${t("hi", "nav.settings")} · Breathprint`));
  });

  test("a link that leaves the app says it opens a new tab", () => {
    const view = renderDemo("/indoors");
    const data = view.getByRole("link", { name: `Open-Meteo ${en("ui.newTab")}` });
    expect(data.getAttribute("target")).toBe("_blank");
    expect(data.getAttribute("rel")).toBe("noopener noreferrer");
  });

  test("every address the build writes a page for has a page behind it", async () => {
    const restore = stubFetch(async () => new Response(null, { status: 503 }));
    try {
      for (const { path } of PAGES) {
        const view = renderDemo(path);
        const heading = await view.findByRole("heading", { level: 1 });
        expect(heading.textContent).not.toBe(en("notFound.title"));
        view.unmount();
      }
    } finally {
      restore();
    }
  });

  test("following a link names the new page and starts reading at its top", async () => {
    const restore = stubFetch(async () => new Response(null, { status: 503 }));
    try {
      const view = renderDemo("/");
      await view.findByRole("heading", { name: en("plan.title") });
      expect(document.title).toBe(en("app.title"));
      // The first page keeps focus where the browser put it.
      expect(document.activeElement).not.toBe(view.getByRole("main"));

      fireEvent.click(view.getByRole("link", { name: en("nav.indoors") }));
      await view.findByRole("heading", { level: 1, name: en("indoors.title") });
      expect(document.title).toBe(`${en("nav.indoors")} · Breathprint`);
      expect(document.activeElement).toBe(view.getByRole("main"));
    } finally {
      restore();
    }
  });
});
