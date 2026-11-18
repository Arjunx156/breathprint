import { GlobalRegistrator } from "@happy-dom/global-registrator";

/**
 * Opens a happy-dom page as the global window. React DOM looks for a document
 * once, when it first loads, so component tests import this file before
 * anything that pulls in React DOM.
 */
export function openPage() {
  if (!GlobalRegistrator.isRegistered) {
    GlobalRegistrator.register({ url: "http://localhost:4173/", width: 1280, height: 800 });
  }
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

openPage();
