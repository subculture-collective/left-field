import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { assertBrowserGuards, installBrowserGuards, navigate } from "./browser-guards";

const correctionsUrl = "/corrections?release=rel_browser&seat=seat_browser";
const profilePath = process.env.E2E_MAP_PROFILE_PATH;
const tokenResponse = { csrfToken: "csrf-browser-token", idempotencyToken: "idempotency-browser-token" };
const areas = [
  "Current holder", "Party", "Seat occupancy", "Bioguide ID", "Birth date", "Other biography",
  "Elections", "Finance", "District context", "District boundary", "Sources", "Other",
];
test.beforeEach(async ({ page }) => {
  installBrowserGuards(page);
  await page.route("**/api/corrections", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: tokenResponse });
      return;
    }
    await route.fulfill({ status: 405, json: { status: "unavailable" } });
  });
});

test.afterEach(async ({ page }, testInfo) => {
  await assertBrowserGuards(page, testInfo);
});

test("opens correction from a profile with only its release and seat-cycle identifiers", async ({ page }) => {
  if (!profilePath) throw new Error("E2E_MAP_PROFILE_PATH is required for mandatory Task11 profile-link coverage");
  await navigate(page, profilePath);

  const link = page.getByRole("link", { name: "Submit a correction" });
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  const destination = new URL(href!, "http://127.0.0.1:3100");
  expect(destination.pathname).toBe("/corrections");
  expect([...destination.searchParams.keys()].sort()).toEqual(["release", "seat"]);
  expect(destination.searchParams.get("release")).toMatch(/^rel_[A-Za-z0-9_-]{1,128}$/);
  expect(destination.searchParams.get("seat")).toMatch(/^seat_[A-Za-z0-9_-]{1,128}$/);

  await link.click();
  await expect(page).toHaveURL(/\/corrections\?release=/);
  await expect(page.locator('input[type="hidden"][name="releaseId"]')).toHaveValue(destination.searchParams.get("release")!);
  await expect(page.locator('input[type="hidden"][name="seatCycleId"]')).toHaveValue(destination.searchParams.get("seat")!);
  await expect(page.locator('input[type="hidden"]')).toHaveCount(2);
});

test("renders the bounded, review-only correction form", async ({ page }) => {
  await navigate(page, correctionsUrl);

  await expect(page.getByText("The cited release is immutable. A submission is reviewed and may be incorporated only in a later release. Sending a correction does not promise acceptance.")).toBeVisible();
  await expect(page.getByText("Do not submit contact details, political or voter information, addresses, demographic information, or signed/private URLs.")).toBeVisible();
  await expect(page.locator('input[type="hidden"][name="releaseId"]')).toHaveValue("rel_browser");
  await expect(page.locator('input[type="hidden"][name="seatCycleId"]')).toHaveValue("seat_browser");
  await expect(page.locator('input[type="hidden"]')).toHaveCount(2);

  const form = page.locator("form.correction-form");
  await expect(form.getByLabel("Correction area")).toBeVisible();
  await expect(form.getByLabel("What should be corrected?")).toBeVisible();
  await expect(form.getByLabel("Source URL (optional)")).toBeVisible();
  await expect(form.getByLabel("Correction area").locator("option")).toHaveText(areas);
  await expect(form.getByLabel("Correction area").locator("option")).toHaveCount(areas.length);
  await expect(form.locator('input:not([type="hidden"]), textarea, select')).toHaveCount(3);
  expect(await form.locator("input, textarea, select").evaluateAll((controls) => controls.map((control) => control.getAttribute("name")))).not.toContainEqual(expect.stringMatching(/political|affiliation|voter|address|demographic|email|contact/i));
});

test("validates, submits one safe request, and focuses the accepted status", async ({ page }) => {
  const requests: Array<{ body: unknown; headers: Record<string, string> }> = [];
  let releasePost!: () => void;
  const postHeld = new Promise<void>((resolve) => { releasePost = resolve; });
  let postStarted!: () => void;
  const postStartedPromise = new Promise<void>((resolve) => { postStarted = resolve; });

  await page.route("**/api/corrections", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: tokenResponse });
    const request = route.request();
    requests.push({ body: request.postDataJSON(), headers: request.headers() });
    postStarted();
    await postHeld;
    await route.fulfill({ status: 202, json: { status: "accepted", correctionId: "00000000-0000-4000-8000-000000000011" } });
  });

  await navigate(page, correctionsUrl);
  const explanation = page.getByLabel("What should be corrected?");
  await explanation.fill("too short");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("Enter an explanation between 20 and 4,000 characters.")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Review the highlighted fields before submitting.");
  expect(requests).toEqual([]);

  await explanation.fill("The published holder needs a source-backed review.");
  await page.getByLabel("Source URL (optional)").fill("https://EXAMPLE.com/evidence?case=A%2F1");
  const button = page.locator('button[type="submit"]');
  await button.click();
  await postStartedPromise;
  await expect(button).toBeDisabled();
  expect(requests).toHaveLength(1);
  releasePost();

  await expect(page.getByRole("status")).toHaveText("Correction received. It will be reviewed; it may be incorporated only in a later release.");
  await expect(page.getByRole("status")).toBeFocused();
  await expect(button).toBeDisabled();
  await expect(page.locator("form.correction-form").getByLabel("Correction area")).toBeDisabled();
  await expect(explanation).toBeDisabled();
  await expect(page.locator("form.correction-form").getByLabel("Source URL (optional)")).toBeDisabled();
  await expect(page.getByText("This report is complete. To report another correction, reopen or reload this page.")).toBeVisible();
  await button.click({ force: true });
  expect(requests).toHaveLength(1);
  expect(requests).toEqual([{
    body: { releaseId: "rel_browser", seatCycleId: "seat_browser", fieldPath: "identity.current_holder", explanation: "The published holder needs a source-backed review.", sourceUrl: "https://EXAMPLE.com/evidence?case=A%2F1" },
    headers: expect.objectContaining({
      "content-type": "application/json",
      "x-csrf-token": tokenResponse.csrfToken,
      "idempotency-key": tokenResponse.idempotencyToken,
    }),
  }]);
});

test("focuses a concise rate-limit response", async ({ page }) => {
  await page.route("**/api/corrections", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: tokenResponse });
    await route.fulfill({ status: 200, json: { status: "rate_limited" } });
  });

  await navigate(page, correctionsUrl);
  await page.getByLabel("What should be corrected?").fill("The published holder needs a source-backed review.");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByRole("status")).toHaveText("Too many submissions. Please wait and try again.");
  await expect(page.getByRole("status")).toBeFocused();
});

test("distinguishes malformed, conflict, and unavailable responses", async ({ page }) => {
  for (const [apiStatus, message] of [
    ["malformed", "The submission could not be accepted. Review the form and try again."],
    ["conflict", "This form was already used with different details. Reload the page before submitting again."],
    ["unavailable", "The correction service is unavailable right now. Please try again later."],
  ] as const) {
    await page.route("**/api/corrections", async (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: tokenResponse });
      await route.fulfill({ status: 200, json: { status: apiStatus } });
    });
    await navigate(page, correctionsUrl);
    await page.getByLabel("What should be corrected?").fill("The published holder needs a source-backed review.");
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(page.getByRole("status")).toHaveText(message);
    await expect(page.getByRole("status")).toBeFocused();
    await page.unroute("**/api/corrections");
  }
});

test("@a11y has no detectable WCAG A/AA violations", async ({ page }) => {
  await navigate(page, correctionsUrl);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
});
