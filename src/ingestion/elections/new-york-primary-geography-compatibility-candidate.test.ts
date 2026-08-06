/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial immutable-candidate mutations */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildNewYorkPrimaryGeographyCandidate, validateNewYorkPrimaryGeographyCandidate } from "./new-york-primary-geography-compatibility-candidate";

const text = (path: string): string => readFileSync(path, "utf8");
const dbf = (path: string, member: string): Buffer => execFileSync("unzip", ["-p", path, member]);
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const build = (sourceLockJson = text("data/source-lock.json")) => {
  const cd118Path = "data/source/tiger2022/tl_2022_36_cd118.zip";
  const cd119Path = "data/source/tiger2025/tl_2025_36_cd119.zip";
  const cd118Zip = readFileSync(cd118Path), cd119Zip = readFileSync(cd119Path);
  return buildNewYorkPrimaryGeographyCandidate({
    proposalJson: text("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"),
    dispositionsJson: text("data/metadata/new-york-house-democratic-primary-dispositions-2022-2024-v2.json"),
    identityJson: text("data/metadata/new-york-current-incumbent-primary-linkage-candidate-v1.json"),
    authorityHtml: text("data/source/elections/primary-results/geography/census-119-congressional-district-bef.html"),
    cd118Zip, cd118Dbf: dbf(cd118Path, "tl_2022_36_cd118.dbf"),
    cd119Zip, cd119Dbf: dbf(cd119Path, "tl_2025_36_cd119.dbf"),
    sourceLockJson,
  });
};

describe("New York primary geography compatibility candidate", () => {
  it("rebuilds the persisted reviewer candidate exactly", () => {
    expect(build()).toEqual(validateNewYorkPrimaryGeographyCandidate(JSON.parse(text("data/metadata/new-york-primary-geography-compatibility-candidate-v1.json"))));
  });

  it("separates 19 exact CD119 rows from 19 redraw-crosswalk-pending rows", () => {
    const value = build();
    expect(value.summary).toEqual({
      identityObservations: 38,
      identityProposedLinkRows: 12,
      identityReportedNoMatchRows: 4,
      identityNonreportedRows: 22,
      redrawCrosswalkRequiredRows: 19,
      exactCd119SessionKeyCandidates: 19,
      numberedDistrictsPerRetainedLayer: 26,
      specialDistrictRowsPerRetainedLayer: 0,
      compatibilityCandidates: 19,
      automaticallyApprovedRows: 0,
      scoreEligibleRows: 0,
    });
    expect(value.rows.filter((row) => row.cycleYear === 2022).every((row) =>
      row.compatibilityDisposition === "redraw_crosswalk_required" &&
      row.evidenceClass === "authoritative_redraw_declared_crosswalk_not_retained" &&
      row.confidence === "none" && !row.compatibilityCandidate
    )).toBe(true);
    expect(value.rows.filter((row) => row.cycleYear === 2024).every((row) =>
      row.compatibilityDisposition === "same_cd119_session_and_geoid_exact_key_candidate" &&
      row.evidenceClass === "derived_exact_session_and_key" &&
      row.confidence === "high" && row.compatibilityCandidate
    )).toBe(true);
    expect(value.rows.every((row) => !row.compatibilityApproved && !row.identityApproved && !row.scoreEligible)).toBe(true);
  });

  it("rejects fully rehashed 2022 promotion and exact parent drift", () => {
    const drifted = structuredClone(build()) as any;
    const row = drifted.rows.find((candidate: any) => candidate.observationId === "ny:geography:2022:03");
    row.compatibilityDisposition = "same_cd119_session_and_geoid_exact_key_candidate";
    row.evidenceClass = "derived_exact_session_and_key";
    row.confidence = "high";
    row.compatibilityCandidate = true;
    row.compatibilityApproved = true;
    row.scoreEligible = true;
    const rowUnsigned = structuredClone(row); delete rowUnsigned.rowSha256;
    row.rowSha256 = digest("dsa-seats:ny-primary-geography-row:v1\0", rowUnsigned);
    drifted.rowSetSha256 = digest("dsa-seats:ny-primary-geography-row-set:v1\0", drifted.rows);
    const unsigned = structuredClone(drifted); delete unsigned.packageSha256;
    drifted.packageSha256 = digest("dsa-seats:ny-primary-geography-candidate:v1\0", unsigned);
    expect(() => validateNewYorkPrimaryGeographyCandidate(drifted)).toThrow("LIFECYCLE_INVALID");

    const lock = JSON.parse(text("data/source-lock.json")) as any;
    lock.entries.find((entry: any) => entry.id === "new-york-current-incumbent-primary-linkage-candidate-v1").parentIds = [];
    expect(() => build(`${JSON.stringify(lock, null, 2)}\n`)).toThrow("SOURCE_LOCK_MISMATCH");
  });
});
