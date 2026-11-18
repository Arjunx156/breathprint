import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Bun runs CommonJS packages such as React DOM before a test file's own
// imports, so a page opened inside the test file comes too late: React DOM
// would decide as it loads that there's no DOM, and send typing down an
// old-IE path where onChange never fires. Load it here with a page up, then
// close the page so the API tests get the real fetch and Response back.
// Component tests open their own page with usePage() from ./dom.
const runtime = {
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  setImmediate,
  clearImmediate,
  queueMicrotask,
};
GlobalRegistrator.register({ url: "http://localhost:4173/" });
if (!("oninput" in document)) Object.assign(document, { oninput: null });
// React keeps references to the timers it finds; give it the runtime's, which outlive this page.
Object.assign(globalThis, runtime);
await import("react-dom/client");
await import("@testing-library/react");
await GlobalRegistrator.unregister();
