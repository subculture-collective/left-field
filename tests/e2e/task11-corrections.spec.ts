import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { assertBrowserGuards, installBrowserGuards, navigate } from "./browser-guards";

const profilePath = process.env.E2E_MAP_PROFILE_PATH;

function watchPrivateCollection(page: Page) {
  const requests: string[] = [];
  const formChunks: string[] = [];
  page.on("request", request => {
    if (request.url().includes("/api/corrections")) requests.push(request.url());
    if (/correction-form/i.test(request.url())) formChunks.push(request.url());
  });
  return { requests, formChunks };
}

test.beforeEach(({ page }) => installBrowserGuards(page));
test.afterEach(async ({ page }, testInfo) => assertBrowserGuards(page, testInfo));

test("default correction status is dark: no controls, collection API, or form chunk", async ({ page }) => {
  const traffic = watchPrivateCollection(page);
  const response = await navigate(page, "/corrections?release=rel_browser&seat=seat_browser");

  expect(await response?.text()).not.toContain("<form");
  await expect(page.getByRole("heading", { name: "Corrections are not enabled here" })).toBeVisible();
  await expect(page.getByText("Private collection is privacy-gated")).toBeVisible();
  await expect(page.locator("main form, main input, main select, main textarea, main button")).toHaveCount(0);
  expect(traffic.requests).toEqual([]);
  expect(traffic.formChunks).toEqual([]);
});

test("profile correction link remains safe when collection is dark", async ({ page }) => {
  test.skip(!profilePath, "E2E_MAP_PROFILE_PATH fixture is not available");
  const traffic = watchPrivateCollection(page);
  await navigate(page, profilePath!);
  const link = page.getByRole("link", { name: "Submit a correction" });
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  const destination = new URL(href!, "http://127.0.0.1:3100");
  expect(destination.pathname).toBe("/corrections");
  expect([...destination.searchParams.keys()].sort()).toEqual(["release", "seat"]);
  await link.click();
  await expect(page).toHaveURL(/\/corrections\?release=/);
  await expect(page.getByRole("heading", { name: "Corrections are not enabled here" })).toBeVisible();
  await expect(page.locator("main form, main input, main select, main textarea, main button")).toHaveCount(0);
  expect(traffic.requests).toEqual([]);
  expect(traffic.formChunks).toEqual([]);
});

test("@a11y dark correction status has no detectable WCAG A/AA violations", async ({ page }) => {
  await navigate(page, "/corrections");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
});
