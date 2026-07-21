import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { assertBrowserGuards, installBrowserGuards, navigate } from "./browser-guards";

const enabled = process.env.E2E_LOOKUP_ENABLED === "1";

test.beforeEach(({ page }) => installBrowserGuards(page));
test.afterEach(async ({ page }, testInfo) => assertBrowserGuards(page, testInfo));

if (!enabled) {
  test("default disabled lookup has no address control, API traffic, or form bundle behavior", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", request => { if (request.url().includes("/api/address/")) requests.push(request.url()); });
    const response = await navigate(page, "/lookup");
    // Next dev deliberately replaces no-store with no-cache for hot reload; production retains no-store.
    expect(response?.headers()["cache-control"]).toMatch(/no-store|no-cache/);
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
    expect(response?.headers()["x-frame-options"]).toBe("DENY");
    expect(response?.headers()["content-security-policy"]).toContain("connect-src 'self'");
    await expect(page.getByRole("heading", { name: "Address lookup is not enabled here" })).toBeVisible();
    await expect(page.getByLabel("Street address")).toHaveCount(0);
    await expect(page.locator("form.lookup-form")).toHaveCount(0);
    expect(requests).toEqual([]);
  });

  test("@a11y disabled lookup has no detectable WCAG A/AA violations", async ({ page }) => {
    await navigate(page, "/lookup");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations).toEqual([]);
  });
} else {
  test("enabled lookup uses intercepted same-origin requests, clears input, and handles territory output", async ({ page }) => {
    const address = "123 Example Street";
    const requests: Array<{ method: string; body: string | null }> = [];
    await page.route("**/api/address/resolve", async route => {
      const request = route.request();
      requests.push({ method: request.method(), body: request.postData() });
      if (request.method() === "GET") return route.fulfill({ json: { csrfToken: "csrf-browser" } });
      return route.fulfill({ json: { status: "matched", senateRepresentation: "none", houseSeat: { officeTermId: "office_house", seatCycleId: "seat_house" }, senateSeats: [] } });
    });
    await navigate(page, "/lookup");
    const input = page.getByLabel("Street address");
    await expect(input).toBeEnabled();
    await expect(page.getByText("sent to the U.S. Census Bureau in a request URL")).toBeVisible();
    await input.fill(address);
    await page.getByRole("button", { name: "Find seats" }).click();
    await expect(page.getByRole("status")).toContainText("Seats matched for the active release.");
    await expect(page.getByText("This territory has no Senate representation.")).toBeVisible();
    await expect(input).toHaveValue("");
    await expect(page).toHaveURL(/\/lookup$/);
    expect(await page.evaluate((value) => JSON.stringify([localStorage, sessionStorage]).includes(value), address)).toBe(false);
    expect(requests).toEqual([{ method: "GET", body: null }, { method: "POST", body: JSON.stringify({ address }) }]);
  });

  test("enabled lookup exposes a finite error without echoing address data", async ({ page }) => {
    await page.route("**/api/address/resolve", async route => route.request().method() === "GET" ? route.fulfill({ json: { csrfToken: "csrf-browser" } }) : route.fulfill({ json: { status: "upstream_failure", detail: "123 Example Street, 1,2" } }));
    await navigate(page, "/lookup");
    await page.getByLabel("Street address").fill("123 Example Street");
    await page.getByRole("button", { name: "Find seats" }).click();
    const status = page.getByRole("status");
    await expect(status).toHaveText("Address lookup is unavailable right now. Please try again later.");
    await expect(status).not.toContainText("123 Example");
    await expect(status).toBeFocused();
  });

  test("@a11y enabled lookup has no detectable WCAG A/AA violations", async ({ page }) => {
    await page.route("**/api/address/resolve", async route => route.fulfill({ json: { csrfToken: "csrf-browser" } }));
    await navigate(page, "/lookup");
    await expect(page.getByLabel("Street address")).toBeEnabled();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations).toEqual([]);
  });
}
