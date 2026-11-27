import type { MessageKey } from "@shared/i18n";
import { pageTitle } from "@shared/pages";
import { type RefObject, useEffect, useRef } from "react";

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
