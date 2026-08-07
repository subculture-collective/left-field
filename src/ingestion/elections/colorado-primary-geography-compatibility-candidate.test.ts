/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial immutable-package mutations */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildColoradoPrimaryGeographyCandidate, validateColoradoPrimaryGeographyCandidate } from "./colorado-primary-geography-compatibility-candidate";

const sha = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
const json = (path: string) => { const bytes = readFileSync(path); return { value: JSON.parse(bytes.toString("utf8")), sha256: sha(bytes) }; };
const dbf = (path: string): Buffer => execFileSync("unzip", ["-p", path, "*.dbf"]);
const build = () => {
  const proposal = json("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"), receipt = json("data/metadata/colorado-house-democratic-primary-results-2022-2026-v1.json"), identity = json("data/metadata/colorado-current-incumbent-primary-linkage-candidate-v1.json");
  const authority = readFileSync("data/source/elections/primary-results/geography/census-119-congressional-district-bef.html"), co118 = readFileSync("data/source/tiger2022/tl_2022_08_cd118.zip"), co119 = readFileSync("data/source/tiger2025/tl_2025_08_cd119.zip");
  return buildColoradoPrimaryGeographyCandidate({ proposal: proposal.value, proposalFileSha256: proposal.sha256, receipt: receipt.value, receiptFileSha256: receipt.sha256, identity: identity.value, identityFileSha256: identity.sha256, authorityHtml: authority.toString("utf8"), authorityFileSha256: sha(authority), co118Dbf: dbf("data/source/tiger2022/tl_2022_08_cd118.zip"), co118FileSha256: sha(co118), co119Dbf: dbf("data/source/tiger2025/tl_2025_08_cd119.zip"), co119FileSha256: sha(co119), sourceLock: json("data/source-lock.json").value });
};

describe("Colorado primary geography compatibility candidate", () => {
  it("separates CD118 continuity, CD119 exact keys, and CD120 pending", () => {
    const value = build();
    expect(value.summary).toEqual({ identityObservations: 12, cd118ToCd119PlanContinuityCandidates: 4, exactCd119SessionKeyCandidates: 4, cd120AuthorityPending: 4, compatibilityCandidates: 8, automaticallyApprovedRows: 0, scoreEligibleRows: 0 });
    expect(value.rows.filter((row) => row.cycleYear === 2022 && row.compatibilityCandidate)).toHaveLength(4);
    expect(value.rows.filter((row) => row.cycleYear === 2024 && row.compatibilityCandidate)).toHaveLength(4);
    expect(value.rows.filter((row) => row.cycleYear === 2026 && row.historicalGeoid === null && !row.compatibilityCandidate && row.evidenceClass === "authority_pending")).toHaveLength(4);
    expect(value.rows.every((row) => !row.compatibilityApproved && !row.identityApproved && !row.scoreEligible)).toBe(true);
  });

  it("rebuilds the persisted candidate exactly and rejects CD120 escalation", () => {
    expect(build()).toEqual(validateColoradoPrimaryGeographyCandidate(json("data/metadata/colorado-primary-geography-compatibility-candidate-v1.json").value));
    const drifted = structuredClone(build()) as any, row = drifted.rows.find((candidate: any) => candidate.cycleYear === 2026); row.historicalGeoid = row.targetCd119Geoid; row.compatibilityCandidate = true;
    expect(() => validateColoradoPrimaryGeographyCandidate(drifted)).toThrow("Colorado primary geography rejected");
  });
});
