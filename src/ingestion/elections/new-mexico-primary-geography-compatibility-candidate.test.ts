/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial immutable-package mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildNewMexicoPrimaryGeographyCandidate, validateNewMexicoPrimaryGeographyCandidate } from "./new-mexico-primary-geography-compatibility-candidate";

const sha = (value: Uint8Array): string => createHash("sha256").update(value).digest("hex");
const json = (path: string) => { const bytes = readFileSync(path); return { bytes, value: JSON.parse(bytes.toString("utf8")), hash: sha(bytes) }; };
const input = () => {
  const proposal = json("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json");
  const receipt = json("data/metadata/new-mexico-house-democratic-primary-results-2022-2026-v1.json");
  const identity = json("data/metadata/new-mexico-current-incumbent-primary-linkage-candidate-v1.json");
  const authority = readFileSync("data/source/elections/primary-results/geography/census-119-congressional-district-bef.html");
  const z118 = readFileSync("data/source/tiger2022/tl_2022_35_cd118.zip");
  const z119 = readFileSync("data/source/tiger2025/tl_2025_35_cd119.zip");
  return { proposal: proposal.value, proposalFileSha256: proposal.hash, receipt: receipt.value, receiptFileSha256: receipt.hash, identity: identity.value, identityFileSha256: identity.hash, authorityHtml: authority.toString(), authorityFileSha256: sha(authority), nm118Dbf: Buffer.from(unzipSync(z118)["tl_2022_35_cd118.dbf"]!), nm118FileSha256: sha(z118), nm119Dbf: Buffer.from(unzipSync(z119)["tl_2025_35_cd119.dbf"]!), nm119FileSha256: sha(z119), sourceLock: json("data/source-lock.json").value };
};
const build = () => buildNewMexicoPrimaryGeographyCandidate(input());
const stored = () => json("data/metadata/new-mexico-primary-geography-compatibility-candidate-v1.json").value as any;
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const rehash = (value: any): any => {
  for (const row of value.rows) { const unsigned = structuredClone(row); delete unsigned.rowSha256; row.rowSha256 = digest("dsa-seats:nm-primary-geography-row:v1\0", unsigned); }
  value.rowSetSha256 = digest("dsa-seats:nm-primary-geography-row-set:v1\0", value.rows);
  const unsigned = structuredClone(value); delete unsigned.packageSha256;
  value.packageSha256 = digest("dsa-seats:nm-primary-geography-package:v1\0", unsigned);
  return value;
};

describe("New Mexico primary geography compatibility candidate", () => {
  it("creates three continuity, three exact-key, and three CD120-pending rows", () => {
    const value = build();
    expect(value.summary).toEqual({ identityObservations: 9, cd118ToCd119PlanContinuityCandidates: 3, exactCd119SessionKeyCandidates: 3, cd120AuthorityPending: 3, compatibilityCandidates: 6, numberedDistrictsPerLayer: 3, automaticallyApprovedRows: 0, scoreEligibleRows: 0 });
    expect(value.rows.filter((row) => row.cycleYear === 2022 && row.historicalCongressSession === "118" && row.historicalGeoid === row.targetCd119Geoid && row.compatibilityCandidate)).toHaveLength(3);
    expect(value.rows.filter((row) => row.cycleYear === 2024 && row.historicalCongressSession === "119" && row.historicalGeoid === row.targetCd119Geoid && row.compatibilityCandidate)).toHaveLength(3);
    expect(value.rows.filter((row) => row.cycleYear === 2026 && row.historicalGeoid === null && !row.compatibilityCandidate && row.evidenceClass === "authority_pending")).toHaveLength(3);
  });

  it("rebuilds the canonical artifact and rejects source-byte drift", () => {
    expect(validateNewMexicoPrimaryGeographyCandidate(build())).toEqual(stored());
    const changed = input(); changed.nm118Dbf[100] ^= 1;
    expect(() => buildNewMexicoPrimaryGeographyCandidate(changed)).toThrow("INPUT_HASH_MISMATCH");
  });

  it.each([
    ["CD120 escalation", (value: any) => { const row = value.rows[6]; row.historicalGeoid = row.targetCd119Geoid; row.compatibilityCandidate = true; row.compatibilityDisposition = "same_cd119_session_and_geoid_exact_key_candidate"; row.evidenceClass = "derived_exact_session_and_key"; row.confidence = "high"; }, "ROW_INVALID"],
    ["cycle leakage", (value: any) => { value.rows[0].cycleYear = 2020; }, "ROW_INVALID"],
    ["identity approval", (value: any) => { value.rows[0].identityApproved = true; }, "ROW_INVALID"],
    ["geography approval", (value: any) => { value.rows[0].compatibilityApproved = true; }, "ROW_INVALID"],
    ["score eligibility", (value: any) => { value.rows[0].scoreEligible = true; }, "ROW_INVALID"],
    ["raw geometry equality claim", (value: any) => { value.methodology.rawTigerGeometryEqualityAssessed = true; }, "LIFECYCLE_INVALID"],
    ["publication", (value: any) => { value.publicationEligible = true; }, "LIFECYCLE_INVALID"],
    ["fabricated reviewer", (value: any) => { value.review.reviewer = "fabricated"; }, "LIFECYCLE_INVALID"],
    ["unknown evaluator field", (value: any) => { value.rows[0].opportunityScore = 99; }, "ROW_FIELDS_INVALID"],
    ["unknown top-level field", (value: any) => { value.deployed = true; }, "PACKAGE_FIELDS_INVALID"],
  ])("rejects fully rehashed %s", (_label, mutate, code) => {
    const value = structuredClone(build()) as any; mutate(value);
    expect(() => validateNewMexicoPrimaryGeographyCandidate(rehash(value))).toThrow(code);
  });

  it("rejects exact source-lock topology drift", () => {
    const changed = input() as any;
    changed.sourceLock.entries.find((entry: any) => entry.id === "new-mexico-primary-geography-compatibility-candidate-v1").parentIds.reverse();
    expect(() => buildNewMexicoPrimaryGeographyCandidate(changed)).toThrow("SOURCE_LOCK_MISMATCH");
    const changedUrl = input() as any;
    changedUrl.sourceLock.entries.find((entry: any) => entry.id === "tiger-cd118-35").url += "?drift";
    expect(() => buildNewMexicoPrimaryGeographyCandidate(changedUrl)).toThrow("SOURCE_LOCK_MISMATCH");
  });
});
