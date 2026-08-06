/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial persisted candidate mutations */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import {
  buildMassachusettsPrimaryGeographyCandidate,
  validateMassachusettsPrimaryGeographyCandidate,
} from "./massachusetts-primary-geography-compatibility-candidate";

const sha256 = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
const digest = (domain: string, value: unknown): string =>
  createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const json = (path: string) => {
  const bytes = readFileSync(path);
  return { bytes, value: JSON.parse(bytes.toString("utf8")), sha256: sha256(bytes) };
};
const dbf = (path: string): Buffer => execFileSync("unzip", ["-p", path, "*.dbf"], { maxBuffer: 4 * 1024 * 1024 });

function build(options?: { cd118Zip?: Buffer; cd119Dbf?: Buffer; sourceLock?: unknown }) {
  const proposal = json("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json");
  const receipt = json("data/metadata/massachusetts-house-democratic-primary-results-2022-2026-v1.json");
  const authority = readFileSync("data/source/elections/primary-results/geography/census-119-congressional-district-bef.html");
  const cd118Zip = readFileSync("data/source/tiger2022/tl_2022_25_cd118.zip");
  const cd119Zip = readFileSync("data/source/tiger2025/tl_2025_25_cd119.zip");
  return buildMassachusettsPrimaryGeographyCandidate({
    proposal: proposal.value,
    proposalFileSha256: proposal.sha256,
    receipt: receipt.value,
    receiptFileSha256: receipt.sha256,
    authorityHtml: authority.toString("utf8"),
    authorityFileSha256: sha256(authority),
    cd118Zip: options?.cd118Zip ?? cd118Zip,
    cd118FileSha256: sha256(cd118Zip),
    cd118Dbf: dbf("data/source/tiger2022/tl_2022_25_cd118.zip"),
    cd119Zip,
    cd119FileSha256: sha256(cd119Zip),
    cd119Dbf: options?.cd119Dbf ?? dbf("data/source/tiger2025/tl_2025_25_cd119.zip"),
    sourceLock: options?.sourceLock ?? json("data/source-lock.json").value,
  });
}

describe("Massachusetts primary geography compatibility candidate", () => {
  it("rebuilds the persisted reviewer candidate exactly", () => {
    expect(build()).toEqual(validateMassachusettsPrimaryGeographyCandidate(
      json("data/metadata/massachusetts-primary-geography-compatibility-candidate-v1.json").value,
    ));
  });

  it("closes all eighteen retained contests without approval or evaluator use", () => {
    const value = build();
    expect(value.summary).toEqual({
      contestCycleObservations: 18,
      cd118ToCd119PlanContinuityCandidates: 9,
      exactCd119SessionKeyCandidates: 9,
      compatibilityCandidates: 18,
      automaticallyApprovedRows: 0,
      scoreEligibleRows: 0,
    });
    expect(value.rows).toHaveLength(18);
    expect(value.rows.every((row) => row.compatibilityCandidate && !row.compatibilityApproved && !row.identityApproved && !row.scoreEligible)).toBe(true);
    expect(validateMassachusettsPrimaryGeographyCandidate(value)).toEqual(value);
  });

  it("keeps plan continuity and exact-session key evidence distinct from geometry equality", () => {
    const value = build();
    expect(value.rows.filter((row) => row.cycleYear === 2022)).toHaveLength(9);
    expect(value.rows.filter((row) => row.cycleYear === 2022).every((row) =>
      row.historicalCongressSession === "118" &&
      row.compatibilityDisposition === "official_no_plan_change_declaration_same_geoid_key_candidate" &&
      row.evidenceClass === "direct_official_plan_continuity_and_derived_key"
    )).toBe(true);
    expect(value.rows.filter((row) => row.cycleYear === 2024)).toHaveLength(9);
    expect(value.rows.filter((row) => row.cycleYear === 2024).every((row) =>
      row.historicalCongressSession === "119" &&
      row.compatibilityDisposition === "same_cd119_session_and_geoid_exact_key_candidate" &&
      row.evidenceClass === "derived_exact_session_and_key"
    )).toBe(true);
    expect(value.methodology).toMatchObject({
      rawTigerGeometryEqualityAssessed: false,
      overlapThresholdUsed: false,
      populationEquivalenceAssessed: false,
      future2026Rows: 0,
    });
  });

  it("rejects geography byte substitution and source-lock parent drift", () => {
    const cd118Zip = readFileSync("data/source/tiger2022/tl_2022_25_cd118.zip");
    expect(() => build({ cd118Zip: Buffer.concat([cd118Zip, Buffer.from([0])]) })).toThrow("INPUT_HASH_MISMATCH");

    const sourceLock = json("data/source-lock.json").value as any;
    const drifted = structuredClone(sourceLock);
    drifted.entries.find((entry: any) => entry.id === "massachusetts-house-democratic-primary-results-2022-2026-v1").parentIds = [];
    expect(() => build({ sourceLock: drifted })).toThrow("SOURCE_LOCK_MISMATCH");
  });

  it("rejects fully rehashed drift from retained contest facts", () => {
    const drifted = structuredClone(build()) as any;
    drifted.rows[0].contestSha256 = "0".repeat(64);
    const unsignedRow = structuredClone(drifted.rows[0]);
    delete unsignedRow.rowSha256;
    drifted.rows[0].rowSha256 = digest("dsa-seats:ma-primary-geography-row:v1\0", unsignedRow);
    drifted.rowSetSha256 = digest("dsa-seats:ma-primary-geography-row-set:v1\0", drifted.rows);
    const unsigned = structuredClone(drifted);
    delete unsigned.packageSha256;
    drifted.packageSha256 = digest("dsa-seats:ma-primary-geography-candidate:v1\0", unsigned);
    expect(() => validateMassachusettsPrimaryGeographyCandidate(drifted)).toThrow("RETAINED_FACT_INVALID");
  });

  it("rejects fully rehashed unknown row semantics", () => {
    const drifted = structuredClone(build()) as any;
    drifted.rows[0].geometryEqualityOverride = true;
    const unsignedRow = structuredClone(drifted.rows[0]);
    delete unsignedRow.rowSha256;
    drifted.rows[0].rowSha256 = digest("dsa-seats:ma-primary-geography-row:v1\0", unsignedRow);
    drifted.rowSetSha256 = digest("dsa-seats:ma-primary-geography-row-set:v1\0", drifted.rows);
    const unsigned = structuredClone(drifted);
    delete unsigned.packageSha256;
    drifted.packageSha256 = digest("dsa-seats:ma-primary-geography-candidate:v1\0", unsigned);
    expect(() => validateMassachusettsPrimaryGeographyCandidate(drifted)).toThrow("ROW_FIELDS_INVALID");
  });
});
