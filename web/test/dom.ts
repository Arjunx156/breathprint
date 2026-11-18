import "./page";
import { afterAll, afterEach, beforeAll } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, cleanup } from "@testing-library/react";
import { openPage } from "./page";

/**
 * A browser page for the tests in this file. Bun runs every file in one
 * process, so the page closes afterwards and the API tests get the real
 * fetch and Response back.
 */
export function withPage() {
  beforeAll(openPage);
  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
  });
  afterAll(async () => {
    // React may still have work queued from the last test; let it run while there's a window.
    await act(() => new Promise((done) => setTimeout(done, 0)));
    await GlobalRegistrator.unregister();
  });
}
