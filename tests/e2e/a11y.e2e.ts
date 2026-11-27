import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Every page a visitor can reach, in the demo so each one has a household to show. */
const PAGES = [
  "/",
  "/ask",
  "/indoors",
  "/community",
  "/settings",
  "/setup",
  "/blog/",
  "/no-such-page",
];
// AA is the bar the law sets; AAA contrast and axe's best practices are the bar this app keeps.
const RULES = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
  "wcag2aaa",
  "wcag21aaa",
  "best-practice",
];

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    for (const path of PAGES) {
      test(`${path} has no WCAG 2.2 AA, AAA or best-practice violations`, async ({ page }) => {
        await page.goto(`${path}?demo=meera`);
        await expect(page.locator("main h1")).toBeVisible();
        const { violations } = await new AxeBuilder({ page }).withTags(RULES).analyze();
        expect(
          violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`),
        ).toEqual([]);
      });
    }
  });
}

test("the first Tab reaches a skip link that moves focus to the page", async ({ page }) => {
  await page.goto("/?demo=meera");
  await expect(page.locator("main h1")).toBeVisible();
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});

// 320 CSS pixels is a 1280 px window at 400% zoom: WCAG's reflow test.
for (const path of PAGES) {
  test(`${path} fits a 320 px screen without scrolling sideways`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(`${path}?demo=meera`);
    await expect(page.locator("main h1")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
