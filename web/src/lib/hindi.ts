import type { MessageKey } from "@shared/i18n";
import type { Language } from "@shared/profile";
import { useEffect, useState } from "react";

/*
 * In the browser build, shared/i18n reads its Hindi strings from here (see
 * lazyHindi in vite.config.ts), so English readers never download them. The
 * object fills in place when someone picks Hindi; the server and the tests
 * import the real file and never come here.
 */

/** @public Imported by shared/i18n in the browser build, through the alias in vite.config.ts. */
export const hi = {} as Record<MessageKey, string>;

let loading: Promise<void> | null = null;

const hindiLoaded = () => Object.keys(hi).length > 0;

function loadHindi(): Promise<void> {
  loading ??= import("@shared/i18n/hi").then((m) => {
    Object.assign(hi, m.hi);
  });
  return loading;
}

/** Whether `lang`'s strings are here yet; asks for them when they aren't. */
export function useLanguageReady(lang: Language): boolean {
  const [, loaded] = useState(0);
  const ready = lang !== "hi" || hindiLoaded();
  useEffect(() => {
    if (!ready) void loadHindi().then(() => loaded((n) => n + 1));
  }, [ready]);
  return ready;
}
