import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { assertBrowserGuards, installBrowserGuards, navigate } from "./browser-guards";

function watchPrivateAddressCode(page: Page) {
  const requests: string[] = [];
  const formChunks: string[] = [];
  page.on("request", request => {
    if (request.url().includes("/api/address/")) requests.push(request.url());
    if (/address-form/i.test(request.url())) formChunks.push(request.url());
  });
  return { requests, formChunks };
}

test.beforeEach(({ page }) => installBrowserGuards(page));
test.afterEach(async ({ page }, testInfo) => assertBrowserGuards(page, testInfo));

test("default lookup is dark, including a canary-equivalent response", async ({ page }) => {
  const traffic = watchPrivateAddressCode(page);
  const response = await navigate(page, "/lookup");

  expect(await response?.text()).not.toContain("<form");
  await expect(page.getByRole("heading", { name: "Address lookup is not enabled here" })).toBeVisible();
  await expect(page.getByText("Address collection is privacy-gated")).toBeVisible();
  await expect(page.locator("main form, main input, main select, main textarea, main button")).toHaveCount(0);
  expect(traffic.requests).toEqual([]);
  expect(traffic.formChunks).toEqual([]);
});

test("@a11y dark lookup has no detectable WCAG A/AA violations", async ({ page }) => {
  await navigate(page, "/lookup");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
});
