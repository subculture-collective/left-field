import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { assertBrowserGuards, installBrowserGuards, navigate } from "./browser-guards";

const profilePath = process.env.E2E_MAP_PROFILE_PATH;

test.beforeEach(async ({ page }) => {
  if (!profilePath) throw new Error("E2E_MAP_PROFILE_PATH is required for mandatory Task10 coverage");
  installBrowserGuards(page);
  await navigate(page, profilePath);
});

test.afterEach(async ({ page }, testInfo) => assertBrowserGuards(page, testInfo));

test("renders the release-pinned district boundary without interactive-map behavior", async ({ page }) => {
  const section = page.getByRole("region", { name: "District boundary" });
  await expect(section).toBeVisible();
  await expect(section.getByText("RELEASE-PINNED GEOGRAPHY")).toBeVisible();

  const map = section.locator("svg");
  await expect(map).toBeVisible();
  await expect(map).toHaveAttribute("focusable", "false");
  await expect(map.locator("title")).toHaveText("District boundary");
  await expect(map.locator("desc")).toContainText("Published boundary for");
  await expect(map.locator("path")).toHaveAttribute("d", /^M/);

  const ledger = section.getByRole("table", { name: "Published boundary record" });
  await expect(ledger).toBeVisible();
  const geoJsonLink = ledger.getByRole("link", { name: "Published boundary GeoJSON" });
  await expect(geoJsonLink).toBeVisible();

  const response = await page.request.get(await geoJsonLink.getAttribute("href") as string);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/geo+json");
  expect(response.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers().etag).toMatch(/^"[a-f0-9]{64}"$/);
  expect(await response.json()).toMatchObject({ type: "Feature", properties: {}, geometry: { type: "MultiPolygon" } });

  await page.keyboard.press("Tab");
  await expect(map).not.toBeFocused();
  await expect(section.locator("button, [role=button], input, select")).toHaveCount(0);
});

test("makes profile data tables keyboard-scrollable with a clear instruction", async ({ page }) => {
  const tableRegions = page.locator(".record-section .table-wrap");
  expect(await tableRegions.count()).toBeGreaterThan(0);

  for (let index = 0; index < await tableRegions.count(); index++) {
    const region = tableRegions.nth(index);
    await expect(region).toHaveAttribute("role", "region");
    await expect(region).toHaveAttribute("tabindex", "0");
    await expect(region).toHaveAttribute("aria-label", /Scroll horizontally to view all columns\.$/);
  }
});

test("@a11y has no detectable WCAG A/AA violations in the map profile", async ({ page }) => {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
});
