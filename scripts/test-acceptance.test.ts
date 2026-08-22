import { afterEach, describe, expect, it, vi } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acceptanceCommands, assertAcceptanceEnvironment, runAcceptance } from "./test-acceptance";

const safe = { ACCEPTANCE_TESTS: "1", DATABASE_URL: "postgresql://dsa_seats@127.0.0.1:5432/dsa_acceptance_integration_test", TEST_DATABASE_URL: "postgresql://dsa_seats@localhost:5432/dsa_acceptance_integration_test", QUERY_DATABASE_URL: "postgresql://dsa_seats@127.0.0.1:5432/dsa_acceptance_query_test", E2E_DATABASE_URL: "postgresql://dsa_seats@127.0.0.1:5432/dsa_acceptance_browser_test", WEB_DATABASE_URL: "postgresql://acceptance_web@127.0.0.1:5432/dsa_acceptance_browser_test", ACCEPTANCE_MAP_ARTIFACT_ROOT: join(tmpdir(), "dsa-seats-task13", "task10-maps"), E2E_MAP_PROFILE_PATH: "/seats/seat_0" };

describe("acceptance harness", () => {
  afterEach(() => vi.restoreAllMocks());
  it("requires opt-in and isolated, credentialed disposable lanes", () => {
    expect(() => assertAcceptanceEnvironment({ ...safe, ACCEPTANCE_TESTS: "true" })).toThrow("exactly 1");
    expect(() => assertAcceptanceEnvironment({ ...safe, DATABASE_URL: "postgresql://db.example/dsa_test" })).toThrow("loopback");
    expect(() => assertAcceptanceEnvironment({ ...safe, CI: "true", DATABASE_URL: "postgresql://dsa_seats@postgres:5432/dsa_acceptance_integration_test", TEST_DATABASE_URL: "postgresql://dsa_seats@postgres:5432/dsa_acceptance_integration_test", QUERY_DATABASE_URL: "postgresql://dsa_seats@postgres:5432/dsa_acceptance_query_test", E2E_DATABASE_URL: "postgresql://dsa_seats@postgres:5432/dsa_acceptance_browser_test", WEB_DATABASE_URL: "postgresql://acceptance_web@postgres:5432/dsa_acceptance_browser_test" })).not.toThrow();
    expect(() => assertAcceptanceEnvironment({ ...safe, DATABASE_URL: "postgresql://dsa_seats@postgres:5432/dsa_acceptance_integration_test" })).toThrow("loopback");
    expect(() => assertAcceptanceEnvironment({ ...safe, QUERY_DATABASE_URL: "postgresql://dsa_seats@localhost/dsa_test_copy" })).toThrow("ending in _test");
    expect(() => assertAcceptanceEnvironment({ ...safe, QUERY_DATABASE_URL: safe.DATABASE_URL })).toThrow("pairwise distinct");
    expect(() => assertAcceptanceEnvironment({ ...safe, E2E_DATABASE_URL: safe.QUERY_DATABASE_URL, WEB_DATABASE_URL: "postgresql://acceptance_web@localhost:5432/dsa_acceptance_query_test" })).toThrow("pairwise distinct");
    expect(() => assertAcceptanceEnvironment({ ...safe, WEB_DATABASE_URL: "postgresql://dsa_seats@localhost/dsa_acceptance_browser_test" })).toThrow("differ from the browser migration owner");
    expect(() => assertAcceptanceEnvironment({ ...safe, DATABASE_URL: "postgresql://dsa_seats@localhost/dsa_acceptance_integration_test?sslmode=disable" })).toThrow("parameters");
    expect(() => assertAcceptanceEnvironment({ ...safe, QUERY_DATABASE_URL: "postgresql://localhost/dsa_acceptance_query_test" })).toThrow("LOGIN username");
    expect(() => assertAcceptanceEnvironment({ ...safe, NODE_ENV: "production" })).toThrow("refuses NODE_ENV");
  });
  it("runs the pinned lane order with lane-specific environments", () => {
    expect(acceptanceCommands.map(({ lane, command, args }) => `${lane}: ${command} ${args.join(" ")}`)).toEqual([
      "integration: npm run db:migrate", "integration: npm run test:integration", "integration: npm run test:run -- --exclude src/db/integration.test.ts", "query: npm run db:migrate", "query: npm run measure:task5-queries", "browser: npm run test:e2e:task13", "static: npm run typecheck", "static: npm run lint", "static: npm run build", "static: npm run data:verify", "static: npm audit --audit-level=low", "static: docker compose config -q", "static: npm run db:generate", "static: git diff --exit-code -- drizzle",
    ]);
    const environments = new Map<string, NodeJS.ProcessEnv>();
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    runAcceptance(safe, (command, args, env) => { environments.set(`${command} ${args.join(" ")}`, env); return { status: 0, output: "passed\n" }; });
    expect(environments.get("npm run test:integration")).toMatchObject({ DATABASE_URL: safe.DATABASE_URL, TEST_DATABASE_URL: safe.DATABASE_URL, WEB_DATABASE_URL: undefined });
    expect(environments.get("npm run measure:task5-queries")).toMatchObject({ DATABASE_URL: safe.QUERY_DATABASE_URL, TEST_DATABASE_URL: safe.QUERY_DATABASE_URL, QUERY_EVIDENCE_MODE: "verify" });
    expect(environments.get("npm run test:e2e:task13")).toMatchObject({ DATABASE_URL: safe.E2E_DATABASE_URL, TEST_DATABASE_URL: safe.E2E_DATABASE_URL, WEB_DATABASE_URL: safe.WEB_DATABASE_URL });
  });
  it("fails before later lanes can run when a test reports skips", () => {
    const calls: string[] = []; vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    expect(() => runAcceptance(safe, (command, args) => { calls.push(args.join(" ")); return { status: 0, output: args[1] === "test:integration" ? "Tests 1 skipped\n" : "passed\n" }; })).toThrow("skipped");
    expect(calls).toEqual(["run db:migrate", "run test:integration"]);
  });
});
