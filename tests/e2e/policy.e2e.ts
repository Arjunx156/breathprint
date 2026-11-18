import { expect, type Page, test } from "@playwright/test";

const PAGES = ["/", "/ask", "/indoors", "/community", "/settings", "/setup", "/blog/", "/nowhere"];

/**
 * Collects every CSP or Trusted Types violation, uncaught error and console
 * error from the first script on. A model that answers 503 is the fallback
 * working, so the browser's own "failed to load" line for it is not a problem.
 */
async function watch(page: Page): Promise<string[]> {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`uncaught: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) {
      problems.push(`console: ${m.text()}`);
    }
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      console.error(`policy: ${e.violatedDirective} blocked ${e.blockedURI || "inline"}`);
    });
  });
  return problems;
}

for (const path of PAGES) {
  test(`${path} runs inside its CSP and Trusted Types without a single violation`, async ({
    page,
  }) => {
    const problems = await watch(page);
    await page.goto(`${path}?demo=meera`);
    await expect(page.locator("h1").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(problems).toEqual([]);
  });
}

test("the app is cross-origin isolated and registers its worker through the policy", async ({
  page,
}) => {
  const problems = await watch(page);
  await page.goto("/?demo=meera");
  await expect(page.locator("main h1")).toBeVisible();
  const state = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return {
      isolated: globalThis.crossOriginIsolated,
      worker: new URL(registration.active?.scriptURL ?? "").pathname,
      enforced: "trustedTypes" in globalThis,
    };
  });
  expect(state).toEqual({ isolated: true, worker: "/sw.js", enforced: true });
  expect(problems).toEqual([]);
});
