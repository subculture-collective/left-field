import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";

/** The mandatory gate must never silently pass with fixture-dependent skips. */
export default class Task13PlaywrightReporter implements Reporter {
  private skipped: string[] = [];

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status === "skipped") this.skipped.push(test.titlePath().join(" › "));
  }

  async onEnd(): Promise<{ status?: "failed" } | void> {
    if (this.skipped.length) {
      console.error(`Task13 browser gate rejected skipped tests:\n${this.skipped.join("\n")}`);
      return { status: "failed" };
    }
  }
}
