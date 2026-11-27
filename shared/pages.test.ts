import { describe, expect, test } from "bun:test";
import { type MessageKey, t } from "./i18n";
import { lostTitle, NOT_FOUND_FILE, PAGES, pageFile, pageTitle } from "./pages";

const en = (key: MessageKey) => t("en", key);

describe("pages", () => {
  test("each page names itself in the tab, and the lost page says it's lost", () => {
    expect(pageTitle("/", en)).toBe(en("app.title"));
    expect(pageTitle("/ask", en)).toBe(`${en("nav.ask")} · Breathprint`);
    expect(pageTitle("/nowhere", en)).toBe(`${en("notFound.title")} · Breathprint`);
    expect(lostTitle(en)).toBe(pageTitle("/nowhere", en));
  });

  test("the front page keeps Vite's index.html and every other page gets its own file", () => {
    expect(pageFile("/")).toBe("index.html");
    expect(pageFile("/community")).toBe("community.html");
    const files = PAGES.map((p) => pageFile(p.path));
    expect(new Set(files).size).toBe(PAGES.length);
    expect(files).not.toContain(NOT_FOUND_FILE);
  });

  test("no two pages share an address or a title", () => {
    expect(new Set(PAGES.map((p) => p.path)).size).toBe(PAGES.length);
    expect(new Set(PAGES.map((p) => pageTitle(p.path, en))).size).toBe(PAGES.length);
  });
});
