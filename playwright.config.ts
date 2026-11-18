import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const CI = Boolean(process.env.CI);

/**
 * The production build on the fixture forecast with no model behind it, so
 * every run sees the same severe morning and the demo's saved answers.
 * Windows ships Edge, so a local run needs no browser download; CI installs
 * Playwright's own Chromium.
 */
export default defineConfig({
  testDir: "tests/e2e",
  // Not *.spec.ts, which bun test would also pick up.
  testMatch: "*.e2e.ts",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.platform === "win32" && !CI ? { channel: "msedge" } : {}),
      },
    },
  ],
  webServer: {
    command: "bun run build && bun run start",
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !CI,
    timeout: 180_000,
    env: {
      PORT: String(PORT),
      AIR_SOURCE: "fixture",
      LLM_PROVIDER: "fake",
      GEMINI_API_KEY: "",
      // Every test browser shares one IP; the limiter has its own unit tests.
      RATE_LIMIT_AI_PER_MIN: "1000",
    },
  },
});
