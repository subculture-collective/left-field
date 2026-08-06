/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial persisted-artifact mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildIllinoisPrimaryStateBoardCertificationAuthority,
  validateIllinoisPrimaryStateBoardCertificationAuthority,
} from "./illinois-primary-state-board-certification-authority";

const root = "data/source/elections/primary-results/illinois/certification";
const artifact = "data/metadata/illinois-primary-state-board-certification-authority-receipt-v1.json";
const sha = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

function input() {
  return {
    parentReceiptJson: readFileSync("data/metadata/illinois-house-democratic-primary-results-receipt-2022-2024-v1.json", "utf8"),
    indexBytes: readFileSync(`${root}/press-release-index.html`),
    release2022Bytes: readFileSync(`${root}/2022-primary-certification-release.pdf`),
    release2022TextBytes: readFileSync(`${root}/2022-primary-certification-release.txt`),
    release2024Bytes: readFileSync(`${root}/2024-primary-certification-release.pdf`),
    release2024TextBytes: readFileSync(`${root}/2024-primary-certification-release.txt`),
    sourceLock: JSON.parse(readFileSync("data/source-lock.json", "utf8")),
  };
}

const load = () => JSON.parse(readFileSync(artifact, "utf8"));

describe("Illinois primary State Board certification authority receipt", () => {
  it("replays the retained authority receipt from exact parent and official source bytes", () => {
    expect(buildIllinoisPrimaryStateBoardCertificationAuthority(input())).toEqual(
      validateIllinoisPrimaryStateBoardCertificationAuthority(load(), input()),
    );
  });

  it("binds election-level certification authority to the exact 17/17 historical contest scope", () => {
    const value = load();
    expect(value.summary).toMatchObject({ elections: 2, contestObservations: 34, cycle2022Contests: 17, cycle2024Contests: 17, candidateBearingContests: 32, noCandidateRowContests: 2, automaticallyApprovedRows: 0, scoreEligibleRows: 0 });
    expect(value.elections).toEqual([
      expect.objectContaining({ cycleYear: 2022, electionDate: "2022-06-28", certificationDate: "2022-07-29", indexDisplayDate: "2022-08-05", indexDateMatchesInstrument: false, status: "state_board_election_results_certified" }),
      expect.objectContaining({ cycleYear: 2024, electionDate: "2024-03-19", certificationDate: "2024-04-19", indexDisplayDate: "2024-04-19", indexDateMatchesInstrument: true, status: "state_board_election_results_certified" }),
    ]);
    expect(value.contestScope).toHaveLength(34);
    expect(value.contestScope.filter((row: any) => row.cycleYear === 2022)).toHaveLength(17);
    expect(value.contestScope.filter((row: any) => row.cycleYear === 2024)).toHaveLength(17);
    expect(value.contestScope.filter((row: any) => row.contestDisposition === "no_democratic_candidate_rows").map((row: any) => row.contestId)).toEqual(["il:2022:us-house:16:democratic", "il:2024:us-house:16:democratic"]);
  });

  it("keeps election certification distinct from contest winner, nomination, approval, and publication", () => {
    const value = load();
    expect(value.methodology).toMatchObject({ electionLevelAuthorityOnly: true, individualContestCertificatesRetained: false, candidateCertificationByNameClaimed: false, winnerSelectionInferred: false, nominationInferred: false, parentContestFactsMutated: false, automaticDecisionClosure: false, evaluatorNumericValues: 0 });
    expect(value.review).toEqual({ status: "proposed", reviewer: null, reviewedAt: null, resolution: null });
    expect(value).toMatchObject({ reviewerOnly: true, publicationEligible: false, scoreEligible: false, deployed: false });
    expect(value.contestScope.every((row: any) => !row.certificationApproved && !row.identityApproved && !row.geographyApproved && !row.scoreEligible && !row.publicationEligible)).toBe(true);
  });

  it("fails closed on source, parent, date, scope, lifecycle, and hash drift", () => {
    for (const key of ["parentReceiptJson", "indexBytes", "release2022Bytes", "release2022TextBytes", "release2024Bytes", "release2024TextBytes"] as const) {
      const value = input();
      if (typeof value[key] === "string") (value as any)[key] += " "; else (value as any)[key] = Buffer.concat([value[key] as Buffer, Buffer.from(" ")]);
      expect(() => buildIllinoisPrimaryStateBoardCertificationAuthority(value)).toThrow(/IL_PRIMARY_CERTIFICATION_AUTHORITY_INVALID/);
    }
    const lock = input();
    lock.sourceLock.entries.find((entry: any) => entry.id === "il-2024-primary-certification-release").parentIds = ["invented"];
    expect(() => buildIllinoisPrimaryStateBoardCertificationAuthority(lock)).toThrow(/IL_PRIMARY_CERTIFICATION_AUTHORITY_INVALID/);

    const mutations = [
      (value: any) => { value.elections[0].certificationDate = "2022-08-05"; },
      (value: any) => { value.elections[0].indexDateMatchesInstrument = true; },
      (value: any) => { value.methodology.individualContestCertificatesRetained = true; },
      (value: any) => { value.methodology.candidateCertificationByNameClaimed = true; },
      (value: any) => { value.contestScope[0].certificationApproved = true; },
      (value: any) => { value.contestScope.find((row: any) => row.contestDisposition === "no_democratic_candidate_rows").contestDisposition = "candidate_rows_retained"; },
      (value: any) => { value.publicationEligible = true; },
      (value: any) => { value.review.reviewer = "fabricated"; },
      (value: any) => { value.packageSha256 = "0".repeat(64); },
    ];
    for (const mutate of mutations) {
      const value = structuredClone(load()); mutate(value);
      expect(() => validateIllinoisPrimaryStateBoardCertificationAuthority(value, input())).toThrow(/IL_PRIMARY_CERTIFICATION_AUTHORITY_INVALID/);
    }
  });

  it("registers the exact retained artifact bytes", () => {
    const bytes = readFileSync(artifact);
    expect(input().sourceLock.entries.find((entry: any) => entry.id === "illinois-primary-state-board-certification-authority-receipt-v1")).toMatchObject({ retainedPath: artifact, byteSize: bytes.length, sha256: sha(bytes), kind: "evidence_receipt" });
  });
});
