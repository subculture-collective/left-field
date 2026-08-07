/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial immutable-package mutations */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildOhioPrimaryGeographyCandidate, validateOhioPrimaryGeographyCandidate } from "./ohio-primary-geography-compatibility-candidate";

const sha = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
const json = (path: string) => { const bytes = readFileSync(path); return { value: JSON.parse(bytes.toString("utf8")), sha256: sha(bytes) }; };
const dbf = (path: string): Buffer => execFileSync("unzip", ["-p", path, "*.dbf"]);
const input = () => {
  const proposal = json("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json");
  const receipt = json("data/metadata/ohio-house-democratic-primary-results-2022-2026-v4.json");
  const identity = json("data/metadata/ohio-current-incumbent-primary-linkage-candidate-v1.json");
  const authority = readFileSync("data/source/elections/primary-results/geography/census-119-congressional-district-bef.html");
  const oh119 = readFileSync("data/source/tiger2025/tl_2025_39_cd119.zip");
  return { proposal: proposal.value, proposalFileSha256: proposal.sha256, receipt: receipt.value, receiptFileSha256: receipt.sha256, identity: identity.value, identityFileSha256: identity.sha256, authorityHtml: authority.toString("utf8"), authorityFileSha256: sha(authority), oh119Dbf: dbf("data/source/tiger2025/tl_2025_39_cd119.zip"), oh119FileSha256: sha(oh119), sourceLock: json("data/source-lock.json").value };
};
const build = () => buildOhioPrimaryGeographyCandidate(input());
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const rehash = (value: any): any => {
  for (const row of value.rows) { const unsigned = structuredClone(row); delete unsigned.rowSha256; row.rowSha256 = digest("dsa-seats:oh-primary-geography-row:v1\0", unsigned); }
  value.rowSetSha256 = digest("dsa-seats:oh-primary-geography-row-set:v1\0", value.rows);
  const unsigned = structuredClone(value); delete unsigned.packageSha256;
  value.packageSha256 = digest("dsa-seats:oh-primary-geography-package:v1\0", unsigned);
  return value;
};

describe("Ohio primary geography compatibility candidate", () => {
  it("keeps five exact CD119 candidates, five CD120-pending rows, and zero 2022 geography rows", () => {
    const value = build();
    expect(value.summary).toEqual({ identityObservations: 10, districtGeographyObservations2022: 0, partialCountyEvidenceExcluded2022: 12, cd118ToCd119PlanContinuityCandidates: 0, exactCd119SessionKeyCandidates: 5, cd120AuthorityPending: 5, compatibilityCandidates: 5, numberedDistrictsInCd119Inventory: 15, automaticallyApprovedRows: 0, scoreEligibleRows: 0 });
    expect(value.rows.filter((row) => row.cycleYear === 2024 && row.historicalCongressSession === "119" && row.historicalGeoid === row.targetCd119Geoid && row.compatibilityCandidate)).toHaveLength(5);
    expect(value.rows.filter((row) => row.cycleYear === 2026 && row.historicalCongressSession === "120" && row.historicalGeoid === null && !row.compatibilityCandidate && row.evidenceClass === "authority_pending" && row.confidence === "none")).toHaveLength(5);
    expect(value.rows.every((row) => !row.geographyObservationId.includes(":2022:") && !row.compatibilityApproved && !row.identityApproved && !row.scoreEligible)).toBe(true);
  });

  it("reproduces the persisted artifact and rejects CD120 escalation", () => {
    expect(build()).toEqual(validateOhioPrimaryGeographyCandidate(json("data/metadata/ohio-primary-geography-compatibility-candidate-v1.json").value));
    const drifted = structuredClone(build()) as any, row = drifted.rows.find((candidate: any) => candidate.cycleYear === 2026);
    row.historicalGeoid = row.targetCd119Geoid; row.compatibilityCandidate = true; row.confidence = "high";
    expect(() => validateOhioPrimaryGeographyCandidate(rehash(drifted))).toThrow("ROW_INVALID");
  });

  it.each([
    ["2022 leakage", (value: any) => { value.rows[0].cycleYear = 2022; }, "ROW_INVALID"],
    ["identity approval", (value: any) => { value.rows[0].identityApproved = true; }, "ROW_INVALID"],
    ["geography approval", (value: any) => { value.rows[0].compatibilityApproved = true; }, "ROW_INVALID"],
    ["score eligibility", (value: any) => { value.rows[0].scoreEligible = true; }, "ROW_INVALID"],
    ["publication", (value: any) => { value.publicationEligible = true; }, "LIFECYCLE_INVALID"],
    ["unknown evaluator field", (value: any) => { value.rows[0].opportunityScore = 99; }, "ROW_FIELDS_INVALID"],
  ])("rejects fully rehashed %s", (_label, mutate, code) => { const value = structuredClone(build()) as any; mutate(value); expect(() => validateOhioPrimaryGeographyCandidate(rehash(value))).toThrow(code); });

  it("rejects exact source-lock topology drift", () => {
    const lockDrift = input() as any;
    lockDrift.sourceLock.entries.find((entry: any) => entry.id === "ohio-primary-geography-compatibility-candidate-v1").parentIds.reverse();
    expect(() => buildOhioPrimaryGeographyCandidate(lockDrift)).toThrow("SOURCE_LOCK_MISMATCH");
  });
});
