/* eslint-disable @typescript-eslint/no-explicit-any -- immutable JSON and adversarial package mutations */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildMinnesotaPrimaryGeographyCandidate, validateMinnesotaPrimaryGeographyCandidate } from "./minnesota-primary-geography-compatibility-candidate";

const sha256 = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const json = (path: string) => { const bytes = readFileSync(path); return { value: JSON.parse(bytes.toString("utf8")), sha256: sha256(bytes) }; };
const dbf = (path: string, member: string): Buffer => execFileSync("unzip", ["-p", path, member], { maxBuffer: 4 * 1024 * 1024 });

function build(options?: { sourceLock?: unknown }) {
  const proposal = json("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json");
  const receipt = json("data/metadata/minnesota-house-democratic-primary-results-2022-2026-v1.json");
  const identity = json("data/metadata/minnesota-current-incumbent-primary-linkage-candidate-v1.json");
  const authority = readFileSync("data/source/elections/primary-results/geography/census-119-congressional-district-bef.html");
  const cd118Path = "data/source/tiger2022/tl_2022_27_cd118.zip", cd119Path = "data/source/tiger2025/tl_2025_27_cd119.zip";
  const cd118Zip = readFileSync(cd118Path), cd119Zip = readFileSync(cd119Path);
  return buildMinnesotaPrimaryGeographyCandidate({
    proposal: proposal.value, proposalFileSha256: proposal.sha256,
    receipt: receipt.value, receiptFileSha256: receipt.sha256,
    identity: identity.value, identityFileSha256: identity.sha256,
    authorityHtml: authority.toString("utf8"), authorityFileSha256: sha256(authority),
    cd118Zip, cd118FileSha256: sha256(cd118Zip), cd118Dbf: dbf(cd118Path, "tl_2022_27_cd118.dbf"),
    cd119Zip, cd119FileSha256: sha256(cd119Zip), cd119Dbf: dbf(cd119Path, "tl_2025_27_cd119.dbf"),
    sourceLock: options?.sourceLock ?? json("data/source-lock.json").value,
  });
}

describe("Minnesota primary geography compatibility candidate", () => {
  it("closes all eight identity observations without changing identity disposition", () => {
    const value = build();
    expect(value.summary).toEqual({
      identityRows: 8, identityProposedLinks: 5, identitySourceAbsentRows: 3,
      cd118ToCd119PlanContinuityCandidates: 4, exactCd119SessionKeyCandidates: 4,
      numberedDistrictsPerRetainedLayer: 8, specialDistrictRowsPerRetainedLayer: 0,
      compatibilityCandidates: 8, automaticallyApprovedRows: 0, scoreEligibleRows: 0,
    });
    expect(value.rows.map((row: any) => [row.observationId, row.identityStatus, row.historicalCongressSession, row.historicalGeoid, row.targetCd119Geoid])).toEqual([
      ["mn:geography:2022:02", "source_absent_district_cycle_unresolved", "118", "2702", "2702"],
      ["mn:geography:2022:03", "source_absent_district_cycle_unresolved", "118", "2703", "2703"],
      ["mn:geography:2022:04", "proposed_identity_link", "118", "2704", "2704"],
      ["mn:geography:2022:05", "proposed_identity_link", "118", "2705", "2705"],
      ["mn:geography:2024:02", "proposed_identity_link", "119", "2702", "2702"],
      ["mn:geography:2024:03", "source_absent_district_cycle_unresolved", "119", "2703", "2703"],
      ["mn:geography:2024:04", "proposed_identity_link", "119", "2704", "2704"],
      ["mn:geography:2024:05", "proposed_identity_link", "119", "2705", "2705"],
    ]);
    expect(value.rows.every((row: any) => row.compatibilityCandidate && !row.compatibilityApproved && !row.identityApproved && !row.scoreEligible)).toBe(true);
  });

  it("preserves result authority and disclaims geometry equality or overlap claims", () => {
    const value = build();
    const absent = value.rows.filter((row: any) => row.identityStatus === "source_absent_district_cycle_unresolved");
    expect(absent.every((row: any) => row.contestId === null && row.contestSha256 === null && row.resultAuthorityStatus === null &&
      row.certificationStatus === null && row.sourceWinnerStatus === "not_applicable_no_reported_contest")).toBe(true);
    const reported = value.rows.filter((row: any) => row.identityStatus === "proposed_identity_link");
    expect(reported.every((row: any) => row.resultAuthorityStatus === "official_portal_reported_result_not_claimed_as_certified_result_bytes" &&
      row.certificationStatus === "event_metadata_only_exact_report_bytes_not_retained" && row.sourceWinnerStatus === "not_marked_by_source")).toBe(true);
    expect(value.methodology).toMatchObject({ rawTigerGeometryEqualityAssessed: false, overlapThresholdUsed: false, populationEquivalenceAssessed: false, future2026Rows: 0 });
  });

  it("is a self-validating proposed package with immutable row and package hashes", () => {
    const value = build();
    expect(validateMinnesotaPrimaryGeographyCandidate(value)).toBe(value);
    expect(value).toMatchObject({ schema: "minnesota-primary-geography-compatibility-candidate-v1", version: 1, reviewerOnly: true, publicationEligible: false, review: { status: "proposed", reviewer: null, reviewedAt: null, resolution: null } });
  });

  it("rejects source-lock provenance drift and fully rehashed approval escalation", () => {
    const lock: any = structuredClone(json("data/source-lock.json").value);
    lock.entries.find((entry: any) => entry.id === "tiger-cd118-27").url = "https://example.invalid/mn.zip";
    expect(() => build({ sourceLock: lock })).toThrow(/SOURCE_LOCK_MISMATCH/);

    const changed: any = structuredClone(build());
    changed.rows[0].compatibilityApproved = true;
    changed.rows[0].identityApproved = true;
    changed.rows[0].scoreEligible = true;
    const row = structuredClone(changed.rows[0]); delete row.rowSha256;
    changed.rows[0].rowSha256 = digest("dsa-seats:mn-primary-geography-row:v1\0", row);
    changed.rowSetSha256 = digest("dsa-seats:mn-primary-geography-row-set:v1\0", changed.rows);
    const projection = changed.rows.map((item: any) => { const copy = structuredClone(item); delete copy.rowSha256; return copy; });
    changed.parentProjectionSha256 = digest("dsa-seats:mn-primary-geography-parent-projection:v1\0", projection);
    const unsigned = structuredClone(changed); delete unsigned.packageSha256;
    changed.packageSha256 = digest("dsa-seats:mn-primary-geography-package:v1\0", unsigned);
    expect(() => validateMinnesotaPrimaryGeographyCandidate(changed)).toThrow(/ROW_INVALID/);
  });

  it("persists a deterministic reviewer artifact identical to a fresh build", () => {
    const artifact = json("data/metadata/minnesota-primary-geography-compatibility-candidate-v1.json").value;
    expect(validateMinnesotaPrimaryGeographyCandidate(artifact)).toEqual(build());
  });
});
