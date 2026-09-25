import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { qualifiedSource, verifiedReceipt } from "./fixtures/qualified-source";
import type { RawIntakeRecord, SourceDefinition } from "./nationwide-intake";
import type { IntakeRepository } from "./repository";
import { createIntakeRepository } from "./repository";
import { runReviewedSource, shadowRunIds } from "./run-source";

const ALLOWED = ["retainRawIntake", "recordRun", "recordSnapshot", "recordSnapshotIssues"] as const;
const PROHIBITED = ["projectGraph", "updateCoverage", "currentCoverage", "runFormula", "selectCalculationInputs", "projectHolder", "holderTransitionFromResult", "schedule", "nextRefreshAt", "retry", "query", "connect"];

type Call = { method: string; args: unknown[] };

/** Records calls to the four allowed methods and throws on any other property access. */
function fakeRepository() {
  const calls: Call[] = [];
  const target: Record<string, unknown> = {};
  for (const method of ALLOWED) target[method] = async (...args: unknown[]) => { calls.push({ method, args }); return method === "retainRawIntake" ? retainedStub(args[0] as RawIntakeRecord) : undefined; };
  const repository = new Proxy(target, {
    get: (object, property) => {
      if (typeof property === "symbol" || property === "then") return undefined;
      if (!(property in object)) throw new Error(`prohibited repository method invoked: ${String(property)}`);
      return object[property];
    },
  }) as unknown as IntakeRepository;
  return { calls, repository, of: (method: string) => calls.filter((call) => call.method === method) };
}

const retainedStub = (record: RawIntakeRecord) => {
  const issues = record.payloadLocator.includes("..") ? [{ code: "PAYLOAD_LOCATOR_INVALID", diagnostic: "payload locator escapes the raw store" }] : [];
  return { id: `raw_${record.payloadSha256.slice(0, 8)}`, disposition: issues.length ? "quarantined" : "accepted", issueCount: issues.length, issues };
};

const row = (overrides: Partial<RawIntakeRecord> = {}): RawIntakeRecord => ({
  sourceKey: "state-election-authority:IN", snapshotId: "caller_supplied", payloadSha256: "a".repeat(64), payloadLocator: "in/result.json",
  sourceNaturalKey: "IN:2024:HD01", kind: "result", observedAt: "2026-05-06T01:00:00Z", payload: { contest: "HD01" }, ...overrides,
});
const cutoff = "2026-08-21T00:00:00Z";
const base = (repository: IntakeRepository, records: readonly RawIntakeRecord[] = [row()]) =>
  ({ source: qualifiedSource(), requestedCutoff: cutoff, receipt: verifiedReceipt(), loadRecords: async () => records, repository });

describe("runReviewedSource", () => {
  it("records an accepted snapshot with a single terminal run row and zero normalized records", async () => {
    const fake = fakeRepository();
    const result = await runReviewedSource(base(fake.repository));
    const ids = shadowRunIds(qualifiedSource().id, cutoff, verifiedReceipt().sha256);
    expect(result).toEqual({ ...ids, snapshotDisposition: "accepted", normalizedRecordCount: 0 });
    expect(fake.calls.map((call) => call.method)).toEqual(["retainRawIntake", "recordRun", "recordSnapshot", "recordSnapshotIssues"]);
    expect(fake.of("retainRawIntake")[0]?.args).toEqual([expect.objectContaining({ snapshotId: ids.snapshotId, sourceKey: "state-election-authority:IN" }), { privacyPolicy: "public_office_only" }]);
    const run = fake.of("recordRun")[0]?.args[0] as Record<string, unknown>;
    expect(run).toMatchObject({ id: ids.runId, sourceDefinitionId: qualifiedSource().id, requestedCutoff: cutoff, status: "succeeded" });
    expect(typeof run.finishedAt).toBe("string");
    expect(fake.of("recordSnapshot")[0]?.args[0]).toEqual({ id: ids.snapshotId, runId: ids.runId, disposition: "accepted", rowCount: 1, acceptedRowCount: 1, quarantinedRowCount: 0 });
    expect(fake.of("recordSnapshotIssues")[0]?.args).toEqual([ids.snapshotId, []]);
  });

  it("keeps the snapshot accepted with row quarantine when one row is bad", async () => {
    const fake = fakeRepository();
    const result = await runReviewedSource(base(fake.repository, [row(), row({ payloadSha256: "b".repeat(64), payloadLocator: "../bad" })]));
    expect(result).toMatchObject({ snapshotDisposition: "accepted_with_row_quarantine", normalizedRecordCount: 0 });
    expect(fake.of("recordRun")[0]?.args[0]).toMatchObject({ status: "succeeded" });
    expect(fake.of("recordSnapshot")[0]?.args[0]).toMatchObject({ disposition: "accepted_with_row_quarantine", rowCount: 2, acceptedRowCount: 1, quarantinedRowCount: 1 });
    expect(fake.of("recordSnapshotIssues")[0]?.args[1]).toEqual([]);
  });

  it("quarantines the whole snapshot and fails the run on parser or authority drift", async () => {
    const fake = fakeRepository();
    const receipt = { ...verifiedReceipt(), finalUrl: "https://mirror.other.example/results" };
    const result = await runReviewedSource({ ...base(fake.repository), receipt });
    expect(result).toMatchObject({ snapshotDisposition: "quarantined", normalizedRecordCount: 0 });
    expect(fake.of("recordRun")[0]?.args[0]).toMatchObject({ status: "failed", receipt });
    expect(fake.of("recordSnapshot")[0]?.args[0]).toMatchObject({ disposition: "quarantined", rowCount: 1, acceptedRowCount: 0, quarantinedRowCount: 1 });
    expect(fake.of("recordSnapshotIssues")[0]?.args[1]).toEqual([expect.objectContaining({ code: "SOURCE_AUTHORITY_MISMATCH", systemic: true })]);
  });

  it("rejects non-reviewed sources before any row or run is written", async () => {
    for (const source of [{ ...qualifiedSource(), status: "draft" }, { ...qualifiedSource(), status: "retired" }, { ...qualifiedSource(), sourceUrl: "http://insecure.example" }] as SourceDefinition[]) {
      const fake = fakeRepository();
      await expect(runReviewedSource({ ...base(fake.repository), source })).rejects.toThrow("OFFICE_UNIVERSE_SOURCE_NOT_REVIEWED");
      expect(fake.calls).toEqual([]);
    }
  });

  it("rejects cutoffs that are not ISO 8601 UTC instants", async () => {
    for (const requestedCutoff of ["2026-08-21", "2026-08-21T00:00:00", "2026-08-21T00:00:00+02:00", "2026-13-40T00:00:00Z", "yesterday"]) {
      const fake = fakeRepository();
      await expect(runReviewedSource({ ...base(fake.repository), requestedCutoff })).rejects.toThrow("OFFICE_UNIVERSE_CUTOFF_INVALID");
      expect(fake.calls).toEqual([]);
    }
  });

  it("rejects an unverified receipt and records nothing", async () => {
    const fake = fakeRepository();
    await expect(runReviewedSource({ ...base(fake.repository), receipt: { ...verifiedReceipt(), verified: false } })).rejects.toThrow("OFFICE_UNIVERSE_RECEIPT_UNVERIFIED");
    expect(fake.calls).toEqual([]);
  });

  it("never touches graph, coverage, formula, holder, scheduler, or retry methods", async () => {
    const fake = fakeRepository();
    await runReviewedSource(base(fake.repository, [row(), row({ payloadSha256: "c".repeat(64), payloadLocator: "../bad" })]));
    expect(fake.calls.every((call) => (ALLOWED as readonly string[]).includes(call.method))).toBe(true);
    for (const method of PROHIBITED) expect(() => (fake.repository as unknown as Record<string, unknown>)[method]).toThrow(`prohibited repository method invoked: ${method}`);
  });

  it("derives identical ids for the same source, cutoff, and digest", () => {
    const first = shadowRunIds("src", cutoff, "b".repeat(64));
    expect(shadowRunIds("src", cutoff, "b".repeat(64))).toEqual(first);
    expect(shadowRunIds("src", cutoff, "c".repeat(64))).not.toEqual(first);
    expect(first.runId).toMatch(/^run_[a-f0-9]{48}$/);
  });
});

describe("runReviewedSource with a raw-store root", () => {
  const bytes = Buffer.from(JSON.stringify({ contest: "HD01" }));
  const digest = createHash("sha256").update(bytes).digest("hex");
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "office-universe-run-source-"));
    await mkdir(join(root, "in"), { recursive: true });
    await writeFile(join(root, "in", "results.json"), bytes);
  });
  afterAll(async () => { await rm(root, { recursive: true, force: true }); });

  it("verifies the retained bytes and marks the receipt verified", async () => {
    const fake = fakeRepository();
    const receipt = { ...verifiedReceipt(), locator: "in/results.json", sha256: digest, byteSize: bytes.length, verified: false };
    await expect(runReviewedSource({ ...base(fake.repository), receipt, rawStoreRoot: root })).resolves.toMatchObject({ snapshotDisposition: "accepted" });
    expect(fake.of("recordRun")[0]?.args[0]).toMatchObject({ receipt: { ...receipt, verified: true } });
  });

  it("records nothing when the retained bytes do not match the receipt", async () => {
    const fake = fakeRepository();
    const receipt = { ...verifiedReceipt(), locator: "in/results.json", sha256: "a".repeat(64), byteSize: bytes.length, verified: true };
    await expect(runReviewedSource({ ...base(fake.repository), receipt, rawStoreRoot: root })).rejects.toThrow("OFFICE_UNIVERSE_OBJECT_SHA256_MISMATCH");
    expect(fake.calls).toEqual([]);
  });
});

describe("runReviewedSource against the SQL repository", () => {
  function fakePool() {
    const texts: string[] = [];
    const client = { query: async (text: string) => { texts.push(text); return { rowCount: 1, rows: [] }; }, release: () => undefined };
    return { texts, pool: { connect: async () => client, query: client.query } as never };
  }

  it("emits only inserts into evidence, run, snapshot, and issue tables", async () => {
    const { texts, pool } = fakePool();
    const receipt = { ...verifiedReceipt(), finalUrl: "https://mirror.other.example/results" };
    await expect(runReviewedSource({ ...base(createIntakeRepository(pool), [row(), row({ payloadSha256: "b".repeat(64), payloadLocator: "../bad" })]), receipt })).resolves.toMatchObject({ snapshotDisposition: "quarantined" });
    const statements = texts.filter((text) => !["BEGIN", "COMMIT", "ROLLBACK"].includes(text));
    expect(statements.every((text) => /^\s*INSERT INTO office_universe\.(raw_payloads|intake_issues|retained_object_receipts|intake_runs|intake_snapshots|snapshot_issues)\(/.test(text))).toBe(true);
    for (const table of ["intake_runs", "intake_snapshots", "snapshot_issues", "retained_object_receipts"]) expect(statements.filter((text) => text.includes(`office_universe.${table}(`))).toHaveLength(1);
    expect(texts.some((text) => /UPDATE|DELETE|DO UPDATE|coverage|offices|seat_cycles|data_releases/.test(text))).toBe(false);
    expect(texts).not.toContain("ROLLBACK");
  });
});
