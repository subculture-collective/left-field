import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const launchOptions = executablePath === undefined ? undefined : { executablePath };
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;
const serverCommand = process.env.E2E_SERVER_COMMAND ?? `npm run dev -- --hostname 127.0.0.1 --port ${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  timeout: 120_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], launchOptions } },
    { name: "mobile-chromium", use: { ...devices["Pixel 5"], launchOptions } },
    { name: "task13-390px", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, launchOptions } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: serverCommand,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
