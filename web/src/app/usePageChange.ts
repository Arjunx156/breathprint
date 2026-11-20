import type { MessageKey } from "@shared/i18n";
import { type RefObject, useEffect, useRef } from "react";

/** What each page is called in the browser tab; any other address is the lost page. */
const TITLES: Readonly<Record<string, MessageKey>> = {
  "/setup": "setup.title",
  "/ask": "nav.ask",
  "/indoors": "nav.indoors",
  "/community": "nav.community",
  "/settings": "nav.settings",
};

/** The tab title for a path. */
export function pageTitle(path: string, t: (key: MessageKey) => string): string {
  if (path === "/") return t("app.title");
  return `${t(TITLES[path] ?? "notFound.title")} · ${t("app.name")}`;
}

/**
 * Names each page in the tab and, on a move between pages, puts focus at the
 * top of the new one, so a screen reader starts reading there instead of
 * staying on the link that was pressed.
 */
export function usePageChange(
  path: string,
  t: (key: MessageKey) => string,
  main: RefObject<HTMLElement | null>,
) {
  const title = pageTitle(path, t);
  const first = useRef(true);

  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    void path; // Runs on every move between pages.
    if (first.current) {
      first.current = false;
      return;
    }
    main.current?.focus({ preventScroll: true });
    scrollTo({ top: 0 });
  }, [path, main]);
}
