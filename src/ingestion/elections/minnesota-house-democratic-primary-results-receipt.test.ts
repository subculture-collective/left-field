// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial tests mutate persisted JSON */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";

import {
  assertMinnesotaPrimarySemanticInvariants,
  buildMinnesotaPrimaryReceipt,
  parseMinnesotaHouseDflPrimaryResults,
  validateMinnesotaPrimaryReceipt,
} from "./minnesota-house-democratic-primary-results-receipt";

const source = (year: 2022 | 2024, kind: "ushouse" | "candidates") => readFileSync(
  resolve(`data/source/elections/primary-results/minnesota/${year}/${kind}.txt`),
  "utf8",
);
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const fixture = () => {
  const lock = JSON.parse(readFileSync("data/source-lock.json", "utf8")) as { entries: any[] };
  const entries = lock.entries.filter((entry) => typeof entry.retainedPath === "string" && entry.retainedPath.startsWith("data/source/elections/primary-results/minnesota/"));
  const inputs = entries.map((entry) => ({ entry, bytes: readFileSync(entry.retainedPath) }));
  const parentBytes = readFileSync("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json");
  return { inputs, parent: { value: JSON.parse(parentBytes.toString("utf8")), fileSha256: hash(parentBytes) } };
};

describe("Minnesota House DFL primary result parsing", () => {
  it("parses and reconciles the complete source-native 2022 and 2024 DFL corpus", () => {
    const values = ([2022, 2024] as const).map((cycleYear) => parseMinnesotaHouseDflPrimaryResults({
      cycleYear,
      resultText: source(cycleYear, "ushouse"),
      candidateText: source(cycleYear, "candidates"),
    }));
    expect(values.map((value) => value.summary)).toEqual([
      { contests: 5, candidates: 15, votes: 309_004 },
      { contests: 7, candidates: 13, votes: 284_195 },
    ]);
    expect(values.flatMap((value) => value.contests).map((contest) => [contest.cycleYear, contest.districtCode])).toEqual([
      [2022, "01"], [2022, "04"], [2022, "05"], [2022, "07"], [2022, "08"],
      [2024, "01"], [2024, "02"], [2024, "04"], [2024, "05"], [2024, "06"], [2024, "07"], [2024, "08"],
    ]);
    expect(values.flatMap((value) => value.contests).every((contest) => (
      contest.sourcePartyCode === "DFL"
      && contest.precinctsReported === contest.precinctsTotal
      && contest.sourceTotalVotes === contest.candidates.reduce((sum, candidate) => sum + candidate.votes, 0)
      && contest.sourceWinnerStatus === "not_marked_by_source"
    ))).toBe(true);
  });

  it("fails closed on party, candidate-table, vote, or reporting drift", () => {
    const base = { cycleYear: 2024 as const, resultText: source(2024, "ushouse"), candidateText: source(2024, "candidates") };
    for (const changed of [
      { ...base, resultText: base.resultText.replace(";DFL;", ";DEM;") },
      { ...base, resultText: base.resultText.replace(";26865;91.02;29514", ";26866;91.02;29514") },
      { ...base, resultText: base.resultText.replace(";257;257;26865", ";256;257;26865") },
      { ...base, candidateText: base.candidateText.replace("01050401;Angie Craig", "01050401;Angie Craigg") },
    ]) expect(() => parseMinnesotaHouseDflPrimaryResults(changed)).toThrow("Minnesota primary results rejected");
  });
});

describe("Minnesota House DFL primary result receipt", () => {
  it("retains the complete DFL source corpus while distinguishing the eight target observations", () => {
    const value = buildMinnesotaPrimaryReceipt(fixture().inputs, fixture().parent);
    expect(value.summary).toMatchObject({
      sourceContests: 12, sourceCandidates: 28, sourceVotes: 593_199,
      targetSeatCycleObservations: 8, targetReportedContests: 5,
      targetSourceAbsentObservations: 3, evaluatorNumericValues: 0, scoreEligibleContests: 0,
    });
    expect(value.targetObservations.map((row) => [row.cycleYear, row.districtCode, row.sourceStatus])).toEqual([
      [2022, "02", "source_absent_no_disposition_inference"],
      [2022, "03", "source_absent_no_disposition_inference"],
      [2022, "04", "portal_reported_contest"],
      [2022, "05", "portal_reported_contest"],
      [2024, "02", "portal_reported_contest"],
      [2024, "03", "source_absent_no_disposition_inference"],
      [2024, "04", "portal_reported_contest"],
      [2024, "05", "portal_reported_contest"],
    ]);
    expect(value.targetObservations.every((row) => !row.scoreEligible && Object.values(row.evaluatorValues).every((item) => item === null))).toBe(true);
  });

  it("binds the correct primary event identities and the statutory future date", () => {
    const value = buildMinnesotaPrimaryReceipt(fixture().inputs, fixture().parent);
    expect(value.cycles).toEqual([
      { cycleYear: 2022, electionDate: "2022-08-09", sourceElectionId: 148, status: "retained_portal_reported_results" },
      { cycleYear: 2024, electionDate: "2024-08-13", sourceElectionId: 169, status: "retained_portal_reported_results" },
      { cycleYear: 2026, scheduledElectionDate: "2026-08-11", sourceElectionId: null, status: "scheduled_not_held_at_source_cutoff", resultRows: 0 },
    ]);
    const wrong = fixture();
    wrong.inputs.find((input) => input.entry.id === "mn-2024-primary-media-file-layout")!.entry.url = "https://electionresults.sos.mn.gov/Results/MediaFileLayout/Index?erselectionId=170";
    expect(() => buildMinnesotaPrimaryReceipt(wrong.inputs, wrong.parent)).toThrow("SOURCE_CLOSURE_INVALID");
  });

  it("keeps certification claims at event-record scope and results at portal-report scope", () => {
    const value = buildMinnesotaPrimaryReceipt(fixture().inputs, fixture().parent);
    expect(value.certificationRecords).toEqual([
      expect.objectContaining({ cycleYear: 2022, documentNumber: "224057", exactReportBytesRetained: false, candidateByCandidateCertificationClaimed: false }),
      expect.objectContaining({ cycleYear: 2024, documentNumber: "20242807", exactReportBytesRetained: false, candidateByCandidateCertificationClaimed: false }),
    ]);
    expect(value.sourceContests.every((contest) => contest.resultStatus === "official_portal_reported_result_not_claimed_as_certified_result_bytes" && contest.sourceWinnerStatus === "not_marked_by_source")).toBe(true);
  });

  it("rejects lifecycle escalation and fully rehashed semantic tampering", () => {
    const value: any = buildMinnesotaPrimaryReceipt(fixture().inputs, fixture().parent);
    value.publicationEligible = true;
    value.targetObservations[0].sourceStatus = "certified_uncontested";
    const unsignedRow = { ...value.targetObservations[0] }; delete unsignedRow.rowSha256;
    value.targetObservations[0].rowSha256 = createHash("sha256").update("dsa-seats:mn-house-democratic-primary-target-observation:v1\0", "ascii").update(canonicalJson(unsignedRow), "utf8").digest("hex");
    const unsigned = { ...value }; delete unsigned.packageSha256;
    value.packageSha256 = createHash("sha256").update("dsa-seats:mn-house-democratic-primary-result-package:v1\0", "ascii").update(canonicalJson(unsigned), "utf8").digest("hex");
    expect(() => assertMinnesotaPrimarySemanticInvariants(value)).toThrow("SEMANTIC_INVARIANT_INVALID");
  });

  it("rejects source-byte and parent-decision drift", () => {
    const drift = fixture(), changed = Buffer.from(drift.inputs[0].bytes); changed[100] ^= 1; drift.inputs[0].bytes = changed;
    expect(() => buildMinnesotaPrimaryReceipt(drift.inputs, drift.parent)).toThrow("SOURCE_BYTES_INVALID");
    const parent = fixture();
    parent.parent.value.decisions.find((decision: any) => decision.decisionId === "collect-official-state-primary-results-and-certification-v1").resolution = "approved";
    expect(() => buildMinnesotaPrimaryReceipt(parent.inputs, parent.parent)).toThrow();
  });

  it("rejects a substituted source even when its metadata and package are fully rehashed", () => {
    const substituted = fixture(), sourceInput = substituted.inputs.find((input) => input.entry.id === "mn-2022-primary-results-landing")!;
    sourceInput.bytes = Buffer.concat([Buffer.from(sourceInput.bytes), Buffer.from(" ")]);
    sourceInput.entry.byteSize = sourceInput.bytes.length;
    sourceInput.entry.sha256 = hash(Buffer.from(sourceInput.bytes));
    expect(() => buildMinnesotaPrimaryReceipt(substituted.inputs, substituted.parent)).toThrow("SOURCE_CLOSURE_INVALID");

    const persisted: any = buildMinnesotaPrimaryReceipt(fixture().inputs, fixture().parent);
    persisted.sources.find((entry: any) => entry.id === "mn-2022-primary-results-landing").byteSize += 1;
    persisted.sources.find((entry: any) => entry.id === "mn-2022-primary-results-landing").sha256 = "0".repeat(64);
    const unsigned = { ...persisted }; delete unsigned.packageSha256;
    persisted.packageSha256 = createHash("sha256").update("dsa-seats:mn-house-democratic-primary-result-package:v1\0", "ascii").update(canonicalJson(unsigned), "utf8").digest("hex");
    expect(() => assertMinnesotaPrimarySemanticInvariants(persisted)).toThrow("SEMANTIC_INVARIANT_INVALID");
  });

  it("matches the checked-in reproducible artifact", () => {
    const value = JSON.parse(readFileSync("data/metadata/minnesota-house-democratic-primary-results-2022-2026-v1.json", "utf8"));
    expect(buildMinnesotaPrimaryReceipt(fixture().inputs, fixture().parent)).toEqual(validateMinnesotaPrimaryReceipt(value));
  });
});

describe("Minnesota primary source importer", () => {
  it("validates the complete eleven-source unit before writing any retained path", () => {
    const root = mkdtempSync(resolve(tmpdir(), "minnesota-primary-import-test-"));
    try {
      const input = resolve(root, "input"), work = resolve(root, "work");
      mkdirSync(input); mkdirSync(work);
      for (const [inputName, retainedPath] of [
        ["mn-2022-primary-landing.html", "data/source/elections/primary-results/minnesota/2022/primary-results-landing.html"],
        ["mn-2022-media-index.html", "data/source/elections/primary-results/minnesota/2022/media-files-index.html"],
        ["mn-2022-ushouse.txt", "data/source/elections/primary-results/minnesota/2022/ushouse.txt"],
        ["mn-2022-candidates.txt", "data/source/elections/primary-results/minnesota/2022/candidates.txt"],
        ["mn-2022-state-canvass-document.html", "data/source/elections/primary-results/minnesota/2022/state-canvass-document-record.html"],
        ["mn-2024-primary-landing.html", "data/source/elections/primary-results/minnesota/2024/primary-results-landing.html"],
        ["mn-2024-ushouse.txt", "data/source/elections/primary-results/minnesota/2024/ushouse.txt"],
        ["mn-2024-candidates.txt", "data/source/elections/primary-results/minnesota/2024/candidates.txt"],
        ["mn-2024-media-file-layout.html", "data/source/elections/primary-results/minnesota/2024/media-file-layout.html"],
        ["mn-2024-state-canvass-document.html", "data/source/elections/primary-results/minnesota/2024/state-canvass-document-record.html"],
      ]) symlinkSync(resolve(retainedPath), resolve(input, inputName));
      writeFileSync(resolve(input, "mn-statute-204d03.html"), Buffer.alloc(64_332));
      const run = spawnSync("node", [resolve("scripts/import-mn-house-democratic-primary-results.mjs")], { cwd: work, env: { ...process.env, MN_PRIMARY_IMPORT_DIR: input }, encoding: "utf8" });
      expect(run.status).not.toBe(0);
      expect(run.stderr).toContain("MN_PRIMARY_SOURCE_DRIFT:mn-statute-204d03.html");
      expect(existsSync(resolve(work, "data"))).toBe(false);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
