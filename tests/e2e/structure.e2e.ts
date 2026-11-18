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
