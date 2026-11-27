import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function open(page: Page, path: string) {
  await page.goto(`${path}?demo=meera`);
  await expect(page.locator("main h1")).toBeVisible();
}

// What a screen reader hears first: a skip link, the site's landmarks and the
// same five places in the same order on every page.
for (const path of ["/", "/ask", "/indoors"]) {
  test(`${path} keeps the landmarks and navigation a screen reader expects`, async ({ page }) => {
    await open(page, path);
    await expect(page.locator("body")).toMatchAriaSnapshot(`
      - link "Skip to content"
      - banner:
        - navigation "Main":
          - list:
            - listitem:
              - link "Today"
            - listitem:
              - link "Ask"
            - listitem:
              - link "Indoors"
            - listitem:
              - link "Community"
            - listitem:
              - link "Settings"
      - main:
        - heading [level=1]
      - contentinfo
    `);
  });
}

test("each page's HTML names its own address before any script runs", async ({
  request,
  baseURL,
}) => {
  for (const path of ["/ask", "/community", "/settings"]) {
    const html = await (await request.get(path)).text();
    expect(html).toContain(`<link rel="canonical" href="${baseURL}${path}" />`);
  }
  const lost = await request.get("/no-such-page");
  expect(lost.status()).toBe(404);
  expect(await lost.text()).toContain('<meta name="robots" content="noindex" />');
});

/** Adds up the page's layout shifts from the first paint on, where the test can read them. */
function tallyShifts() {
  let total = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
      if (!shift.hadRecentInput) total += shift.value;
      document.documentElement.dataset.shift = String(total);
    }
  }).observe({ type: "layout-shift", buffered: true });
}

// On a slow phone line the page's code and forecast arrive after the frame is
// drawn; nothing already on screen may jump when they do.
for (const path of ["/settings", "/setup", "/ask"]) {
  test(`${path} doesn't shift what's on screen as it loads on a slow line`, async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 823 });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: 200_000,
      uploadThroughput: 90_000,
    });
    await page.addInitScript(tallyShifts);
    await page.goto(`${path}?demo=meera`);
    await expect(page.locator("main h1")).toBeVisible({ timeout: 20_000 });
    await page.waitForLoadState("networkidle");
    const shift = Number((await page.locator("html").getAttribute("data-shift")) ?? 0);
    expect(shift).toBeLessThan(0.01);
  });
}

test.describe("Windows high contrast", () => {
  test.use({ forcedColors: "active" });

  for (const path of ["/", "/ask", "/indoors", "/community"]) {
    test(`${path} has no violations with forced colours`, async ({ page }) => {
      await open(page, path);
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(
        violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target} ${n.failureSummary}`)),
      ).toEqual([]);
    });
  }

  test("keyboard focus stays visible when the system picks the colours", async ({ page }) => {
    await open(page, "/");
    await page.keyboard.press("Tab");
    const ring = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element);
      return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
    });
    // A box-shadow ring would vanish here; an outline is redrawn in the system's colour.
    expect(ring.style).not.toBe("none");
    expect(ring.width).toBeGreaterThanOrEqual(2);
  });

  test("the chosen option still stands out from the others", async ({ page }) => {
    await open(page, "/settings");
    const fill = (name: string) =>
      page
        .locator(".chip", { has: page.getByRole("radio", { name, exact: true }) })
        .evaluate((el) => getComputedStyle(el).backgroundColor);
    await expect(page.getByRole("radio", { name: "English" })).toBeChecked();
    expect(await fill("English")).not.toBe(await fill("हिन्दी"));
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("nothing animates when the system asks for less motion", async ({ page }) => {
    await open(page, "/");
    const moving = await page.evaluate(() =>
      [...document.querySelectorAll("*")]
        .filter((el) => {
          const s = getComputedStyle(el);
          const longest = (list: string) =>
            Math.max(
              ...list.split(",").map((d) => Number.parseFloat(d) * (d.endsWith("ms") ? 1 : 1000)),
            );
          return longest(s.animationDuration) > 1 || longest(s.transitionDuration) > 1;
        })
        .map((el) => el.tagName.toLowerCase() + (el.className ? `.${el.className}` : "")),
    );
    expect(moving).toEqual([]);
  });
});
