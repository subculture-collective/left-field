/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial immutable-package mutations */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildGeorgiaPrimaryGeographyCandidate, validateGeorgiaPrimaryGeographyCandidate } from "./georgia-primary-geography-compatibility-candidate";

const sha = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
const json = (path: string) => { const bytes = readFileSync(path); return { value: JSON.parse(bytes.toString("utf8")), sha256: sha(bytes) }; };
const input = () => {
  const proposal = json("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json");
  const receipt = json("data/metadata/georgia-house-democratic-primary-results-2022-2026-v1.json");
  const identity = json("data/metadata/georgia-current-incumbent-primary-linkage-candidate-v1.json");
  const crosswalk = json("data/metadata/georgia-cd118-cd119-block-crosswalk-candidate-v1.json");
  const layer = readFileSync("data/source/tiger2025/tl_2025_13_cd119.zip");
  return { proposal: proposal.value, proposalFileSha256: proposal.sha256, receipt: receipt.value, receiptFileSha256: receipt.sha256, identity: identity.value, identityFileSha256: identity.sha256, crosswalk: crosswalk.value, crosswalkFileSha256: crosswalk.sha256, authorityBytes: readFileSync("data/source/elections/primary-results/geography/census-119-congressional-district-bef.html"), cd118Bytes: readFileSync("data/source/elections/primary-results/geography/georgia/historical/13_GA_CD118.txt"), cd119Bytes: readFileSync("data/source/elections/primary-results/geography/georgia/current/13_GA_CD119.txt"), ga119Dbf: execFileSync("unzip", ["-p", "data/source/tiger2025/tl_2025_13_cd119.zip", "*.dbf"]), ga119FileSha256: sha(layer), sourceLock: json("data/source-lock.json").value };
};
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const rehash = (value: any): any => {
  for (const row of value.rows) { const unsigned = structuredClone(row); delete unsigned.rowSha256; row.rowSha256 = digest("dsa-seats:ga-primary-geography-row:v1\0", unsigned); }
  value.rowSetSha256 = digest("dsa-seats:ga-primary-geography-row-set:v1\0", value.rows);
  const unsigned = structuredClone(value); delete unsigned.packageSha256; value.packageSha256 = digest("dsa-seats:ga-primary-geography-package:v1\0", unsigned); return value;
};

describe("Georgia primary geography compatibility candidate", () => {
  it("preserves the redraw boundary across twelve identity observations", () => {
    const value = buildGeorgiaPrimaryGeographyCandidate(input());
    expect(value.summary).toEqual({ identityObservations: 12, exactCd118ToCd119BlockMembershipCandidates: 1, cd118ToCd119CrosswalkReviewRequired: 2, noSameBlockMembershipNoCandidate: 1, exactCd119SessionKeyCandidates: 4, cd120AuthorityPending: 4, compatibilityCandidates: 5, numberedDistrictsInCd119Inventory: 14, automaticallyApprovedRows: 0, scoreEligibleRows: 0 });
    expect(value.rows.find((row) => row.geographyObservationId === "ga:geography:2022:02")).toMatchObject({ compatibilityDisposition: "exact_block_membership_candidate", compatibilityCandidate: true, confidence: "high" });
    expect(value.rows.find((row) => row.geographyObservationId === "ga:geography:2022:06")).toMatchObject({ sourceDistrictCode: "07", historicalGeoid: "1307", targetCd119Geoid: "1306", sameBlockCountForTarget: 0, compatibilityDisposition: "no_same_block_membership_no_geography_candidate", compatibilityCandidate: false, confidence: "none" });
    expect(value.rows.filter((row) => row.cycleYear === 2024 && row.compatibilityCandidate)).toHaveLength(4);
    expect(value.rows.filter((row) => row.cycleYear === 2026 && !row.compatibilityCandidate && row.historicalGeoid === null)).toHaveLength(4);
    expect(value).toEqual(validateGeorgiaPrimaryGeographyCandidate(json("data/metadata/georgia-primary-geography-compatibility-candidate-v1.json").value));
  });

  it.each([
    ["CD120 escalation", (value: any) => { const row = value.rows.find((candidate: any) => candidate.cycleYear === 2026); row.historicalGeoid = row.targetCd119Geoid; row.compatibilityCandidate = true; row.confidence = "high"; }],
    ["zero-overlap promotion", (value: any) => { const row = value.rows.find((candidate: any) => candidate.geographyObservationId === "ga:geography:2022:06"); row.historicalGeoid = "1313"; row.compatibilityCandidate = true; row.confidence = "high"; }],
    ["split promotion", (value: any) => { const row = value.rows.find((candidate: any) => candidate.geographyObservationId === "ga:geography:2022:04"); row.compatibilityDisposition = "exact_block_membership_candidate"; row.compatibilityCandidate = true; }],
    ["identity approval", (value: any) => { value.rows[0].identityApproved = true; }],
    ["geography approval", (value: any) => { value.rows[0].compatibilityApproved = true; }],
    ["score", (value: any) => { value.rows[0].scoreEligible = true; }],
    ["publication", (value: any) => { value.publicationEligible = true; }],
    ["unknown evaluator field", (value: any) => { value.rows[0].opportunityScore = 99; }],
  ])("rejects fully rehashed %s", (_label, mutate) => { const value = structuredClone(buildGeorgiaPrimaryGeographyCandidate(input())) as any; mutate(value); expect(() => validateGeorgiaPrimaryGeographyCandidate(rehash(value))).toThrow("Georgia primary geography rejected"); });

  it("rejects direct and output source-lock topology drift", () => {
    for (const id of ["georgia-cd118-cd119-block-crosswalk-candidate-v1", "georgia-primary-geography-compatibility-candidate-v1"]) {
      const value = input() as any; value.sourceLock.entries.find((entry: any) => entry.id === id).parentIds.reverse(); expect(() => buildGeorgiaPrimaryGeographyCandidate(value)).toThrow();
    }
  });
});
