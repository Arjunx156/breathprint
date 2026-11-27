import type { MessageKey } from "./i18n";

/**
 * Every address the app answers, and what each is called in the browser tab.
 * The build writes an HTML file per page so each has its own title and
 * canonical link, and both servers answer anything else with a 404.
 */
export const PAGES = [
  { path: "/", title: "app.title" },
  { path: "/setup", title: "setup.title" },
  { path: "/ask", title: "nav.ask" },
  { path: "/indoors", title: "nav.indoors" },
  { path: "/community", title: "nav.community" },
  { path: "/settings", title: "nav.settings" },
] as const satisfies readonly { path: `/${string}`; title: MessageKey }[];

/** One of the app's own addresses. */
export type PagePath = (typeof PAGES)[number]["path"];

/** The tab title for a path; the front page carries the full name, an unknown one is lost. */
export function pageTitle(path: string, t: (key: MessageKey) => string): string {
  const page = PAGES.find((p) => p.path === path);
  if (!page) return lostTitle(t);
  return page.path === "/" ? t(page.title) : `${t(page.title)} · ${t("app.name")}`;
}

/** The tab title for an address the app doesn't have. */
export function lostTitle(t: (key: MessageKey) => string): string {
  return `${t("notFound.title")} · ${t("app.name")}`;
}

/** The built HTML file for a page: the front page is Vite's own index.html. */
export function pageFile(path: PagePath): string {
  return path === "/" ? "index.html" : `${path.slice(1)}.html`;
}

/** The lost page's HTML, served with a 404 for every address not listed above. */
export const NOT_FOUND_FILE = "404.html";
