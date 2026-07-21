import { describe, expect, it } from "vitest";
import Task13PlaywrightReporter from "./task13-playwright-reporter";
import { assertTask13Environment, task13BrowserEnvironment, task13PlaywrightArgs } from "./test-e2e-task13";

describe("Task13 E2E harness safety", () => {
  const safe = { DATABASE_URL: "postgres://localhost/seats_task13_test", MAP_ARTIFACT_ROOT: "/tmp/task13/browser/task10-maps", E2E_MAP_PROFILE_PATH: "/seats/seat_0" };
  it("requires a disposable database and a dedicated local fixture root", () => {
    expect(() => assertTask13Environment({ ...safe, DATABASE_URL: "postgres://localhost/seats" })).toThrow("ending in _test");
    expect(() => assertTask13Environment({ ...safe, DATABASE_URL: "postgres://localhost/seats_test_copy" })).toThrow("ending in _test");
    expect(() => assertTask13Environment({ ...safe, DATABASE_URL: "postgres://prod.example/seats_test" })).toThrow("refuses production");
    expect(() => assertTask13Environment({ ...safe, MAP_ARTIFACT_ROOT: "/srv/task13/task10-maps" })).toThrow("temp/test path");
    expect(() => assertTask13Environment({ ...safe, MAP_ARTIFACT_ROOT: "/tmp/task13/maps" })).toThrow("dedicated Task10");
    expect(() => assertTask13Environment({ ...safe, E2E_BASE_URL: "https://example.com" })).toThrow("E2E_BASE_URL");
    expect(() => assertTask13Environment({ ...safe, E2E_MAP_PROFILE_PATH: "/" })).toThrow("E2E_MAP_PROFILE_PATH");
    expect(assertTask13Environment(safe)).toMatchObject({ mapRoot: safe.MAP_ARTIFACT_ROOT });
  });

  it("runs the complete desktop and exact-390 mandatory matrix with no focused tests", () => {
    expect(task13PlaywrightArgs).toContain("tests/e2e/nationwide-mvp.spec.ts");
    expect(task13PlaywrightArgs).toContain("tests/e2e/task10-map.spec.ts");
    expect(task13PlaywrightArgs).toContain("tests/e2e/task11-corrections.spec.ts");
    expect(task13PlaywrightArgs).toContain("tests/e2e/task12-lookup.spec.ts");
    expect(task13PlaywrightArgs).toEqual(expect.arrayContaining(["--project=desktop-chromium", "--project=task13-390px", "--workers=1", "--forbid-only"]));
    expect(task13PlaywrightArgs.join(" ")).toContain("--reporter=list,./scripts/task13-playwright-reporter.ts");
  });

  it("always uses the local development server and keeps Task12 disabled", () => {
    const fixture = assertTask13Environment(safe);
    const env = task13BrowserEnvironment({ ...process.env, E2E_LOOKUP_ENABLED: "1", E2E_SERVER_COMMAND: "npm run start" }, fixture, 4321);
    expect(env).toMatchObject({ E2E_PORT: "4321" });
    expect(env.E2E_SERVER_COMMAND).toBeUndefined();
    expect(env.E2E_LOOKUP_ENABLED).toBeUndefined();
  });

  it("does not add a build or production-server command", () => {
    expect(task13PlaywrightArgs.join(" ")).not.toContain("build");
    expect(task13PlaywrightArgs.join(" ")).not.toContain("start");
  });

  it("rejects skipped results while the list reporter retains visible test output", async () => {
    const reporter = new Task13PlaywrightReporter();
    reporter.onTestEnd({ titlePath: () => ["Task 12", "disabled lookup"] } as never, { status: "skipped" } as never);
    await expect(reporter.onEnd()).resolves.toEqual({ status: "failed" });
  });
});
