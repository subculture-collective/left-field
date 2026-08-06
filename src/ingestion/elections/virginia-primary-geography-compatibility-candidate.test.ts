/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial immutable-candidate mutations */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildVirginiaPrimaryGeographyCandidate, validateVirginiaPrimaryGeographyCandidate } from "./virginia-primary-geography-compatibility-candidate";

const read = (path: string) => readFileSync(path);
const dbf = (path: string, member: string) => execFileSync("unzip", ["-p", path, member]);
const digest = (domain: string, value: unknown) => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const build = (lockBytes = read("data/source-lock.json")) => buildVirginiaPrimaryGeographyCandidate({
  proposalBytes: read("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"),
  receiptBytes: read("data/metadata/virginia-house-democratic-primary-results-2022-2026-v1.json"),
  identityBytes: read("data/metadata/virginia-current-incumbent-primary-linkage-candidate-v1.json"),
  authorityBytes: read("data/source/elections/primary-results/geography/census-119-congressional-district-bef.html"),
  cd118Zip: read("data/source/tiger2022/tl_2022_51_cd118.zip"),
  cd118Dbf: dbf("data/source/tiger2022/tl_2022_51_cd118.zip", "tl_2022_51_cd118.dbf"),
  cd119Zip: read("data/source/tiger2025/tl_2025_51_cd119.zip"),
  cd119Dbf: dbf("data/source/tiger2025/tl_2025_51_cd119.zip", "tl_2025_51_cd119.dbf"),
  sourceLockBytes: lockBytes,
});
const rehash = (value: any) => {
  for (const row of value.rows) { const unsigned = { ...row }; delete unsigned.rowSha256; row.rowSha256 = digest("dsa-seats:va-primary-geography-row:v1\0", unsigned); }
  value.parentProjectionSha256 = digest("dsa-seats:va-primary-geography-parent-projection:v1\0", value.rows.map((row:any) => { const projected={...row};delete projected.rowSha256;return projected }));
  value.rowSetSha256 = digest("dsa-seats:va-primary-geography-row-set:v1\0", value.rows);
  const unsigned = { ...value }; delete unsigned.packageSha256; value.packageSha256 = digest("dsa-seats:va-primary-geography-package:v1\0", unsigned); return value;
};

describe("Virginia primary geography compatibility candidate", () => {
  it("closes all twelve identity rows against complete CD118 and CD119 inventories", () => {
    const value = build();
    expect(value.summary).toEqual({ identityRows: 12, identityProposedLinks: 3, identityNoMatchRows: 1, identityUnassessedRows: 8, cd118ToCd119PlanContinuityCandidates: 6, exactCd119SessionKeyCandidates: 6, numberedDistrictsPerLayer: 11, specialDistrictRowsPerLayer: 0, compatibilityCandidates: 12, automaticallyApprovedRows: 0, scoreEligibleRows: 0 });
    expect(value.rows.map((row) => row.observationId)).toEqual([2022, 2024].flatMap((year) => ["03", "04", "07", "08", "10", "11"].map((district) => `va:geography:${year}:${district}`)));
    expect(value.rows.filter((row) => row.cycleYear === 2022).every((row) => row.historicalCongressSession === "118" && row.compatibilityDisposition === "official_no_plan_change_declaration_same_geoid_key_candidate")).toBe(true);
    expect(value.rows.filter((row) => row.cycleYear === 2024).every((row) => row.historicalCongressSession === "119" && row.compatibilityDisposition === "same_cd119_session_and_geoid_exact_key_candidate")).toBe(true);
    expect(value.rows.find((row) => row.observationId === "va:geography:2024:11")).toEqual(expect.objectContaining({ identityStatus: "reported_contest_no_current_incumbent_match", identityDispositionPreserved: true, compatibilityCandidate: true, compatibilityApproved: false }));
    expect(value.rows.every((row) => !row.identityApproved && !row.compatibilityApproved && !row.scoreEligible)).toBe(true);
    expect(validateVirginiaPrimaryGeographyCandidate(value)).toEqual(value);
    expect(read("data/metadata/virginia-primary-geography-compatibility-candidate-v1.json").toString("utf8")).toBe(`${JSON.stringify(value, null, 2)}\n`);
  });

  it("rejects output source-lock lineage drift",()=>{const lock=JSON.parse(read("data/source-lock.json").toString("utf8"));lock.entries.find((entry:any)=>entry.id==="virginia-primary-geography-compatibility-candidate-v1").url="urn:forged";expect(()=>build(Buffer.from(JSON.stringify(lock)))).toThrow("VA_PRIMARY_GEOGRAPHY_CANDIDATE_INVALID")});

  it.each([
    ["raw geometry equality", (value: any) => { value.rawTigerGeometryEqualityAssessed = true; }],
    ["identity approval", (value: any) => { value.rows[0].identityApproved = true; }],
    ["compatibility approval", (value: any) => { value.rows[0].compatibilityApproved = true; }],
    ["score eligibility", (value: any) => { value.rows[0].scoreEligible = true; }],
    ["identity disposition", (value: any) => { value.rows.find((row: any) => row.observationId === "va:geography:2024:11").identityStatus = "proposed_identity_link"; }],
    ["unknown claim", (value: any) => { value.rows[0].populationEquivalent = true; }],
    ["publication", (value: any) => { value.publicationEligible = true; }],
  ])("rejects fully rehashed %s escalation", (_label, mutate) => { const value = structuredClone(build()) as any; mutate(value); expect(() => validateVirginiaPrimaryGeographyCandidate(rehash(value))).toThrow("VA_PRIMARY_GEOGRAPHY_CANDIDATE_INVALID"); });
});
