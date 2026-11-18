import { expect, test } from "@playwright/test";

/** Waits until the service worker has cached the app and controls the page. */
async function workerReady(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;
    await new Promise((done) =>
      navigator.serviceWorker.addEventListener("controllerchange", done, { once: true }),
    );
  });
}

test("after one visit, every page opens with the network gone", async ({ page, context }) => {
  await page.goto("/?demo=meera");
  await expect(page.locator("main h1")).toBeVisible();
  await workerReady(page);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("main h1")).toBeVisible();

  // Never visited online: their code came down with the first visit.
  for (const [link, heading] of [
    ["Ask", "Ask about today's air"],
    ["Indoors", "Scan a room"],
    ["Community", /advisory/i],
  ] as const) {
    await page.getByRole("navigation").getByRole("link", { name: link }).click();
    await expect(page.locator("main h1")).toHaveText(heading);
  }
});

test("offline, Ask falls back to Breathprint's own notes", async ({ page, context }) => {
  await page.goto("/ask?demo=meera");
  await expect(page.locator("main h1")).toBeVisible();
  await workerReady(page);

  await context.setOffline(true);
  await page.getByRole("button", { name: "Can the children play outside today?" }).click();
  await expect(page.getByText("notes from Breathprint's library", { exact: false })).toBeVisible();
});
