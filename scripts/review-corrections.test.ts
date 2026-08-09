import { describe, expect, it } from "vitest";
import packageJson from "../package.json";
import { correctionReviewerPoolConfig, executeCorrectionReview, parseCorrectionReviewArguments, runCorrectionReviewCli } from "./review-corrections";

describe("correction reviewer CLI", () => {
  it("renders help and version without opening a database connection", async () => {
    const help: string[] = [];
    const version: string[] = [];
    const forbiddenPool = () => { throw new Error("database must not be opened"); };

    await expect(runCorrectionReviewCli(["--help"], {}, { write: value => help.push(value), createPool: forbiddenPool })).resolves.toBe(0);
    await expect(runCorrectionReviewCli(["--version"], {}, { write: value => version.push(value), createPool: forbiddenPool })).resolves.toBe(0);

    expect(help.join("")).toContain("corrections:review -- list [options]");
    expect(help.join("")).toContain("corrections:review -- transition [options]");
    expect(version.join("").trim()).toBe(packageJson.version);
  });

  it("generates bash, zsh, and fish completion scripts without opening a database connection", async () => {
    const forbiddenPool = () => { throw new Error("database must not be opened"); };
    for (const shell of ["bash", "zsh", "fish"] as const) {
      const output: string[] = [];
      await expect(runCorrectionReviewCli(["completion", shell], {}, { write: value => output.push(value), createPool: forbiddenPool })).resolves.toBe(0);
      expect(output.join("")).toContain("list");
      expect(output.join("")).toContain("transition");
    }
    await expect(runCorrectionReviewCli(["completion", "powershell"], {}, { write: () => undefined, createPool: forbiddenPool })).rejects.toThrow("bash, zsh, or fish");
  });

  it("lists review metadata without exposing submitted content by default", async () => {
    const args = parseCorrectionReviewArguments(["list", "--limit", "10"]);
    const repository = {
      list: async () => [{
        id: "11111111-1111-4111-8111-111111111111",
        releaseId: "rel_public",
        seatCycleId: "seat_house_me_01_current",
        fieldPath: "finance",
        explanation: "Sensitive submitted explanation",
        sourceUrl: "https://example.test/evidence",
        submittedAt: new Date("2026-08-08T12:00:00.000Z"),
        status: "submitted",
        sequence: 1,
      }],
      transition: async () => { throw new Error("not called"); },
    };

    await expect(executeCorrectionReview(args, repository)).resolves.toEqual({
      operation: "list",
      count: 1,
      items: [{
        id: "11111111-1111-4111-8111-111111111111",
        releaseId: "rel_public",
        seatCycleId: "seat_house_me_01_current",
        fieldPath: "finance",
        submittedAt: "2026-08-08T12:00:00.000Z",
        status: "submitted",
        sequence: 1,
        explanationPresent: true,
        sourceUrlPresent: true,
      }],
    });
  });

  it("requires an optimistic state transition and returns only its outcome", async () => {
    const argv = [
      "transition",
      "--id", "11111111-1111-4111-8111-111111111111",
      "--expected-sequence", "1",
      "--expected-status", "submitted",
      "--to-status", "in_review",
      "--reason", "triaged",
    ];
    const args = parseCorrectionReviewArguments(argv);
    const calls: unknown[] = [];
    const repository = {
      list: async () => { throw new Error("not called"); },
      transition: async (input: unknown) => { calls.push(input); return { outcome: "transitioned" as const, sequence: 2 }; },
    };

    await expect(executeCorrectionReview(args, repository)).resolves.toEqual({
      operation: "transition",
      correctionId: "11111111-1111-4111-8111-111111111111",
      outcome: "transitioned",
      sequence: 2,
    });
    expect(calls).toEqual([{
      correctionId: "11111111-1111-4111-8111-111111111111",
      expectedSequence: 1,
      expectedStatus: "submitted",
      toStatus: "in_review",
      reasonCode: "triaged",
    }]);
  });

  it("rejects ambiguous arguments and requires the dedicated reviewer connection", () => {
    expect(() => parseCorrectionReviewArguments(["list", "--limit", "10", "--limit", "20"])).toThrow();
    expect(() => parseCorrectionReviewArguments([
      "transition", "--id", "11111111-1111-4111-8111-111111111111",
      "--expected-sequence", "1", "--expected-status", "submitted",
      "--to-status", "accepted", "--reason", "approved",
    ])).toThrow("Invalid correction transition");
    expect(() => correctionReviewerPoolConfig({ CORRECTION_DATABASE_URL: "postgresql://intake@db/app" })).toThrow("CORRECTION_REVIEWER_DATABASE_URL is required");
    expect(correctionReviewerPoolConfig({ CORRECTION_REVIEWER_DATABASE_URL: "postgresql://reviewer@db/app" })).toMatchObject({ connectionString: "postgresql://reviewer@db/app", max: 2 });
  });

  it("refuses sensitive content on redirected or non-interactive output", async () => {
    const args = parseCorrectionReviewArguments(["list", "--include-content"]);
    const repository = {
      list: async () => [{
        id: "11111111-1111-4111-8111-111111111111", releaseId: "rel_public", seatCycleId: null,
        fieldPath: "other", explanation: "Private correction content", sourceUrl: null,
        submittedAt: new Date("2026-08-08T12:00:00.000Z"), status: "submitted", sequence: 1,
      }],
      transition: async () => { throw new Error("not called"); },
    };
    await expect(executeCorrectionReview(args, repository, { outputIsTTY: false })).rejects.toThrow("interactive TTY");
    await expect(executeCorrectionReview(args, repository, { outputIsTTY: true })).resolves.toMatchObject({
      items: [{ explanation: "Private correction content", sourceUrl: null }],
    });
  });

  it("matches the complete PostgreSQL transition graph and evidence arity", () => {
    const base = ["transition", "--id", "11111111-1111-4111-8111-111111111111", "--expected-sequence", "2"];
    const allowed = [
      ["submitted", "in_review", "triaged"],
      ["submitted", "rejected", "not_actionable"],
      ["submitted", "rejected", "withdrawn"],
      ["in_review", "accepted", "approved"],
      ["in_review", "rejected", "not_actionable"],
      ["in_review", "rejected", "withdrawn"],
      ["accepted", "rejected", "not_actionable"],
      ["accepted", "rejected", "withdrawn"],
      ["queued", "accepted", "candidate_ready"],
    ];
    for (const [from, to, reason] of allowed) expect(() => parseCorrectionReviewArguments([
      ...base, "--expected-status", from!, "--to-status", to!, "--reason", reason!,
    ])).not.toThrow();
    expect(() => parseCorrectionReviewArguments([
      ...base, "--expected-status", "accepted", "--to-status", "queued", "--reason", "needs_candidate",
      "--candidate-release", "rel_candidate",
    ])).not.toThrow();
    expect(() => parseCorrectionReviewArguments([
      ...base, "--expected-status", "queued", "--to-status", "incorporated", "--reason", "incorporated",
      "--candidate-release", "rel_candidate", "--approved-snapshot", "snap_approved",
    ])).not.toThrow();
    expect(() => parseCorrectionReviewArguments([
      ...base, "--expected-status", "accepted", "--to-status", "queued", "--reason", "needs_candidate",
    ])).toThrow("requires only a candidate release");
    expect(() => parseCorrectionReviewArguments([
      ...base, "--expected-status", "queued", "--to-status", "incorporated", "--reason", "incorporated",
      "--candidate-release", "rel_candidate",
    ])).toThrow("requires candidate release and approved snapshot");
  });

  it("parses complete cursors and preserves non-success transition outcomes", async () => {
    expect(parseCorrectionReviewArguments([
      "list", "--after-time", "2026-08-08T12:00:00.000Z", "--after-id", "11111111-1111-4111-8111-111111111111",
    ])).toMatchObject({ after: { submittedAt: new Date("2026-08-08T12:00:00.000Z"), id: "11111111-1111-4111-8111-111111111111" } });
    expect(() => parseCorrectionReviewArguments(["list", "--after-time", "2026-08-08T12:00:00.000Z"])).toThrow("supplied together");
    const args = parseCorrectionReviewArguments([
      "transition", "--id", "11111111-1111-4111-8111-111111111111", "--expected-sequence", "1",
      "--expected-status", "submitted", "--to-status", "in_review", "--reason", "triaged",
    ]);
    for (const outcome of ["conflict", "invalid_transition"] as const) {
      const repository = { list: async () => [], transition: async () => ({ outcome, sequence: null }) };
      await expect(executeCorrectionReview(args, repository)).resolves.toMatchObject({ outcome, sequence: null });
    }
  });
});
