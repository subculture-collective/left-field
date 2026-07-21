import { describe, expect, it, vi } from "vitest";
import { executeReleaseHealth, parseReleaseHealthArguments, releaseHealthExitCode, releaseHealthPoolConfig } from "./release-health";

describe("release health CLI", () => {
  it("requires one valid release argument", () => {
    expect(parseReleaseHealthArguments(["--release", "rel_safe"])).toBe("rel_safe");
    expect(() => parseReleaseHealthArguments([])).toThrow("Require exactly");
    expect(() => parseReleaseHealthArguments(["--release", "rel_postgres_secret"])).not.toThrow();
    expect(() => parseReleaseHealthArguments(["--release", "rel_postgres://secret"])).toThrow("Require exactly");
    expect(() => parseReleaseHealthArguments(["--release", "wrong", "--extra"])).toThrow("Require exactly");
  });

  it("validates a PostgreSQL URL and nonempty LOGIN without authorizing by its spelling", () => {
    expect(releaseHealthPoolConfig({ RELEASE_PREFLIGHT_DATABASE_URL: "postgresql://dsa_seats_release_preflight:secret@localhost/db" })).toEqual({ connectionString: "postgresql://dsa_seats_release_preflight:secret@localhost/db" });
    expect(releaseHealthPoolConfig({ DATABASE_URL: "postgres://other", RELEASE_PREFLIGHT_DATABASE_URL: "postgres://web:secret@localhost/db" })).toEqual({ connectionString: "postgres://web:secret@localhost/db" });
    expect(() => releaseHealthPoolConfig({ RELEASE_PREFLIGHT_DATABASE_URL: "postgres://localhost/db" })).toThrow("LOGIN username");
    expect(() => releaseHealthPoolConfig({})).toThrow("RELEASE_PREFLIGHT_DATABASE_URL is required");
  });

  it("does not open a connection when arguments are invalid", async () => {
    const createPool = vi.fn();
    await expect(executeReleaseHealth([], { RELEASE_PREFLIGHT_DATABASE_URL: "postgres://dsa_seats_release_preflight:secret@localhost/db" }, { createPool })).rejects.toThrow("Require exactly");
    expect(createPool).not.toHaveBeenCalled();
  });

  it("fails only repository failures, not expected production telemetry blocking", () => {
    expect(releaseHealthExitCode({ repositoryStatus: "fail" })).toBe(1);
    expect(releaseHealthExitCode({ repositoryStatus: "blocked" })).toBe(1);
    expect(releaseHealthExitCode({ repositoryStatus: "pass" })).toBe(0);
  });
});
