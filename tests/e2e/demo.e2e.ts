import { expect, test } from "@playwright/test";

/*
 * The demo path a judge follows, on the fixture's severe Delhi morning with
 * no model behind the server: the engine's plan, the working behind a step,
 * and the saved Gemini answers the demo falls back on.
 */

test("Today shows the air, the plan and the working behind a step", async ({ page }) => {
  await page.goto("/?demo=meera");
  await expect(page.getByRole("heading", { level: 1, name: "Air today" })).toBeVisible();
  await expect(page.getByText(/^Cleanest today 12:00 to 17:00/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your plan for today" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your breathprint today" })).toBeVisible();

  const numbers = page.getByRole("button", { name: "See the numbers" }).first();
  const panel = page.locator(`[id="${await numbers.getAttribute("aria-controls")}"]`);
  await numbers.click();
  await expect(page.getByRole("button", { name: "Hide the numbers" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(panel.getByText("How we worked this out")).toBeVisible();
});

test("marking a step done moves the breathprint", async ({ page }) => {
  await page.goto("/?demo=meera");
  const done = page.getByRole("checkbox").first();
  await done.check();
  await expect(done).toBeChecked();
  await expect(page.getByText("From what you've done so far")).toBeVisible();
});

test("Ask answers a suggested question with its sources", async ({ page }) => {
  await page.goto("/ask?demo=meera");
  await page.getByRole("button", { name: "Can the children play outside today?" }).click();
  await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
  await expect(page.getByText("A saved Gemini answer for this demo.")).toBeVisible();
});

test("Community writes an advisory with the shared-air figure", async ({ page }) => {
  await page.goto("/community?demo=meera");
  await page.getByRole("button", { name: "Rewrite it with Gemini" }).click();
  await expect(page.getByRole("heading", { name: "Do", exact: true })).toBeVisible();
  await expect(page.getByText("A saved Gemini answer for this demo.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy the text" })).toBeVisible();
});

test("switching to Hindi changes the words and the page language", async ({ page }) => {
  await page.goto("/settings?demo=meera");
  // The radio is drawn by its label, so the label is what a person taps.
  await page.getByText("हिन्दी", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "हिन्दी" })).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.getByRole("link", { name: "आज" })).toBeVisible();
});

test("an unknown address has a way home", async ({ page }) => {
  await page.goto("/no-such-page?demo=meera");
  await expect(
    page.getByRole("heading", { name: "This page drifted off in the smog" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to today" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Air today" })).toBeVisible();
});
