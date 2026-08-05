import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildIllinoisHouseDemocraticPrimaryResultsReceipt, type IllinoisSourceLockEntry, validateIllinoisHouseDemocraticPrimaryResultsReceipt } from "./illinois-house-democratic-primary-results-receipt";
import { canonicalJson } from "../fec/aipac-proposed-packages";

const lock = JSON.parse(readFileSync(resolve("data/source-lock.json"), "utf8")) as { entries: IllinoisSourceLockEntry[] };
const listings = () => lock.entries.filter(({ id }) => /^il-(2022|2024)-house-primary-listing$/.test(id));
const results = () => lock.entries.filter(({ id }) => /^il-(2022|2024)-house-primary-district-(0[1-9]|1[0-7])$/.test(id)).map((entry) => ({ entry, bytes: readFileSync(resolve(entry.retainedPath)) }));

describe("Illinois House Democratic primary official-result candidate", () => {
  it("retains every district in both cycles and reconciles Democratic candidate and administrative votes", () => {
    const receipt = validateIllinoisHouseDemocraticPrimaryResultsReceipt(buildIllinoisHouseDemocraticPrimaryResultsReceipt({ listings: listings(), results: results() }));
    expect(receipt.summary).toMatchObject({ cycles: 2, districtsPerCycle: 17, contests: 34, contestsWithCandidateRows: 32, noDemocraticCandidateRowContests: 2, listingSources: 2, resultSources: 34 });
    expect(new Set(receipt.contests.map(({ contestId }) => contestId)).size).toBe(34);
    expect(receipt.contests.every((contest) => contest.democraticBallotsAccounted === contest.candidateVotes + Object.values(contest.administrativeVotes).reduce((sum, value) => sum + value, 0))).toBe(true);
    expect(receipt.contests.filter(({ contestDisposition }) => contestDisposition === "no_democratic_candidate_rows").map(({ contestId }) => contestId)).toEqual(["il:2022:us-house:16:democratic", "il:2024:us-house:16:democratic"]);
    expect(receipt.contests.some((contest) => contest.candidates.some(({ candidateName }) => candidateName.includes('"')))).toBe(true);
  });

  it("keeps raw official results outside evaluation and publication until four independent review gates close", () => {
    const receipt = buildIllinoisHouseDemocraticPrimaryResultsReceipt({ listings: listings(), results: results() });
    expect(receipt).toMatchObject({ reviewerOnly: true, publicationEligible: false, status: "official_result_candidate", certificationStatus: "not_retained", summary: { certificationReceipts: 0, incumbentIdentityMappings: 0, geographyApprovals: 0, evaluatorNumericValues: 0, scoreEligibleContests: 0 } });
    expect(receipt.unresolvedGates).toEqual(["retain_final_state_canvass_or_certification", "review_incumbent_candidate_identity", "review_historical_district_compatibility", "review_progressive_candidate_classification"]);
    expect(receipt.contests.every((contest) => !contest.scoreEligible && Object.values(contest.evaluatorValues).every((value) => value === null))).toBe(true);
  });

  it("fails closed on missing sources, altered bytes, and mutated package claims", () => {
    expect(() => buildIllinoisHouseDemocraticPrimaryResultsReceipt({ listings: listings(), results: results().slice(1) })).toThrow("RESULT_SOURCE_CLOSURE_INVALID");
    const changed = results(); changed[0] = { ...changed[0]!, bytes: Buffer.concat([changed[0]!.bytes, Buffer.from("x")]) };
    expect(() => buildIllinoisHouseDemocraticPrimaryResultsReceipt({ listings: listings(), results: changed })).toThrow("SOURCE_FILE_RECEIPT_MISMATCH");
    const receipt = structuredClone(buildIllinoisHouseDemocraticPrimaryResultsReceipt({ listings: listings(), results: results() }));
    (receipt as { publicationEligible: boolean }).publicationEligible = true;
    expect(() => validateIllinoisHouseDemocraticPrimaryResultsReceipt(receipt)).toThrow("PACKAGE_INVARIANT_INVALID");
  });

  it("rejects a candidate-name mutation even after every affected hash is recomputed", () => {
    const receipt = structuredClone(buildIllinoisHouseDemocraticPrimaryResultsReceipt({ listings: listings(), results: results() }));
    const digest = (domain: string, value: unknown) => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
    (receipt.contests[0]!.candidates[0]! as { candidateName: string }).candidateName = "TAMPERED CANDIDATE";
    const { contestSha256: _oldContestHash, ...contestUnsigned } = receipt.contests[0]!;
    expect(_oldContestHash).toMatch(/^[a-f0-9]{64}$/);
    (receipt.contests[0]! as { contestSha256: string }).contestSha256 = digest("dsa-seats:il-house-democratic-primary-contest:v1\0", contestUnsigned);
    (receipt.summary as { contestSetSha256: string }).contestSetSha256 = digest("dsa-seats:il-house-democratic-primary-contest-set:v1\0", receipt.contests.map(({ contestId, contestSha256 }) => ({ contestId, contestSha256 })));
    const { packageSha256: _oldPackageHash, ...packageUnsigned } = receipt;
    expect(_oldPackageHash).toMatch(/^[a-f0-9]{64}$/);
    (receipt as { packageSha256: string }).packageSha256 = digest("dsa-seats:il-house-democratic-primary-package:v1\0", packageUnsigned);
    expect(() => validateIllinoisHouseDemocraticPrimaryResultsReceipt(receipt)).toThrow("PACKAGE_INVARIANT_INVALID");
  });

  it("binds the checked-in receipt to the exact source-lock closure", () => {
    const path = "data/metadata/illinois-house-democratic-primary-results-receipt-2022-2024-v1.json";
    const bytes = readFileSync(resolve(path)); const receipt = validateIllinoisHouseDemocraticPrimaryResultsReceipt(JSON.parse(bytes.toString("utf8")));
    const entry = lock.entries.find(({ id }) => id === "illinois-house-democratic-primary-results-receipt-2022-2024-v1")!;
    expect(entry).toMatchObject({ retainedPath: path, byteSize: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex"), kind: "review_candidate" });
    expect(entry.parentIds).toHaveLength(37);
    expect(receipt.sources.map(({ id }) => id)).toEqual(entry.parentIds.filter((id) => id.includes("district-")));
  });
});
