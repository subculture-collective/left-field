import { expect, type Page, type TestInfo } from "@playwright/test";

type BrowserDiagnostics = { consoleErrors: string[]; failedRequests: string[]; serverErrors: string[] };

const diagnosticsByPage = new WeakMap<Page, BrowserDiagnostics>();

/** Install mandatory browser-health checks before a test starts. */
export function installBrowserGuards(page: Page): void {
  const diagnostics: BrowserDiagnostics = { consoleErrors: [], failedRequests: [], serverErrors: [] };
  diagnosticsByPage.set(page, diagnostics);
  page.on("console", message => { if (message.type() === "error") diagnostics.consoleErrors.push(message.text()); });
  page.on("requestfailed", request => diagnostics.failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "failed"}`));
  page.on("response", response => { if (response.status() >= 500) diagnostics.serverErrors.push(`${response.status()} ${response.url()}`); });
}

/** Attach diagnostics even when assertions fail, then reject every browser failure. */
export async function assertBrowserGuards(page: Page, testInfo: TestInfo): Promise<void> {
  const diagnostics = diagnosticsByPage.get(page) ?? { consoleErrors: [], failedRequests: [], serverErrors: [] };
  await testInfo.attach("browser-diagnostics", {
    body: ["console", ...diagnostics.consoleErrors, "requestfailed", ...diagnostics.failedRequests, "5xx", ...diagnostics.serverErrors].join("\n"),
    contentType: "text/plain",
  });
  expect(diagnostics.consoleErrors).toEqual([]);
  expect(diagnostics.failedRequests).toEqual([]);
  expect(diagnostics.serverErrors).toEqual([]);
}

/** Let document resources settle before replacing the document. */
export async function navigate(page: Page, url: string) {
  await page.evaluate(() => document.fonts.ready);
  const response = await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
  return response;
}
