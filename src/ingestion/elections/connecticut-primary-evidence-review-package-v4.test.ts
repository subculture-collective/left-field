import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildConnecticutPrimaryEvidenceReviewPackageV4, validateConnecticutPrimaryEvidenceReviewPackageV4 } from "./connecticut-primary-evidence-review-package-v4";

type Package = ReturnType<typeof buildConnecticutPrimaryEvidenceReviewPackageV4>;
type MutablePackage = {
  records: Array<{
    primaryNominationStatus: unknown;
    eventDispositionEvidence: { resultConclusion: unknown; voteValues: unknown; certificationStatus: unknown };
    approved: boolean;
    scoreEligible: boolean;
    evaluatorValues: Record<string, unknown>;
  }>;
  decisions: Array<{ reviewer: unknown; resolution: unknown }>;
  publicationEligible: boolean;
};

const input = () => ({
  v3Bytes: readFileSync("data/metadata/connecticut-primary-evidence-review-package-v3.json"),
  eventDispositionBytes: readFileSync("data/metadata/connecticut-house-democratic-primary-event-dispositions-2022-2024-v1.json"),
  v2Bytes: readFileSync("data/metadata/connecticut-primary-evidence-review-package-v2.json"),
  ballotBytes: readFileSync("data/metadata/connecticut-final-primary-ballot-receipt-v1.json"),
  catalogBytes: readFileSync("data/source/elections/primary-results/connecticut/ballots/source-catalog-v1.json"),
  sourceLockBytes: readFileSync("data/source-lock.json"),
});

describe("Connecticut primary evidence review package v4", () => {
  it("attaches ten official no-reported-contest observations without creating a disposition", () => {
    const value = buildConnecticutPrimaryEvidenceReviewPackageV4(input());
    expect(value.summary).toEqual({
      reviewRecords: 10,
      cycles: 2,
      completeOfficialEvents: 2,
      advertisedEventResults: 39,
      enumeratedEventResults: 39,
      democraticHouseEventResults: 0,
      eventEvidenceAttachedRecords: 10,
      noReportedContestObservations: 10,
      ballotEvidenceAttachedRecords: 10,
      ballotIndexTownRows: 338,
      linkedDemocraticBallots: 196,
      noDemocraticBallotLinkRows: 142,
      linkedBallotsWithHouseOfficeContest: 0,
      districtSpecificBallotJoins: 0,
      primaryNominationConclusions: 0,
      resultConclusions: 0,
      approvedRecords: 0,
      scoreEligibleRecords: 0,
      eventScopeDecisions: 1,
      automaticApprovals: 0,
    });
    expect(value.records).toHaveLength(10);
    expect(value.records.map((row) => [row.cycleYear, row.districtCode])).toEqual([
      [2022, "01"], [2022, "02"], [2022, "03"], [2022, "04"], [2022, "05"],
      [2024, "01"], [2024, "02"], [2024, "03"], [2024, "04"], [2024, "05"],
    ]);
    expect(value.records.every((row) => row.primaryNominationStatus === null && row.resultStatus === null && !row.approved && !row.scoreEligible)).toBe(true);
    expect(value.records.filter((row) => row.eventDispositionEvidence.officialEventId === 598)).toHaveLength(5);
    expect(value.records.filter((row) => row.eventDispositionEvidence.officialEventId === 583)).toHaveLength(5);
    expect(value.records.every((row) => row.eventDispositionEvidence.dispositionConclusion === null && row.eventDispositionEvidence.resultConclusion === null && row.eventDispositionEvidence.voteValues === null)).toBe(true);
    expect(value.decisions).toHaveLength(4);
    expect(value.decisions.every((decision) => decision.status === "proposed" && decision.reviewer === null && decision.reviewedAt === null && decision.resolution === null)).toBe(true);
  });

  it("rebuilds the persisted artifact exactly", () => {
    expect(`${JSON.stringify(buildConnecticutPrimaryEvidenceReviewPackageV4(input()), null, 2)}\n`).toBe(readFileSync("data/metadata/connecticut-primary-evidence-review-package-v4.json", "utf8"));
  });

  it("rejects direct-parent source-lock topology drift", () => {
    const changed = input();
    const lock = JSON.parse(changed.sourceLockBytes.toString("utf8"));
    lock.entries.find((entry: { id: string }) => entry.id === "connecticut-primary-evidence-review-package-v4").parentIds.reverse();
    changed.sourceLockBytes = Buffer.from(JSON.stringify(lock));
    expect(() => buildConnecticutPrimaryEvidenceReviewPackageV4(changed)).toThrow(/source_lock/);
  });

  it("rejects modified immutable parent bytes", () => {
    const changed = input();
    const parent = JSON.parse(changed.eventDispositionBytes.toString("utf8"));
    parent.events[1].eventId = 584;
    changed.eventDispositionBytes = Buffer.from(JSON.stringify(parent));
    expect(() => buildConnecticutPrimaryEvidenceReviewPackageV4(changed)).toThrow(/parent_bytes/);
  });

  const semanticEscalations: Array<[string, (value: MutablePackage) => void]> = [
    ["primary disposition", (value) => { value.records[0]!.primaryNominationStatus = "no_primary"; }],
    ["result conclusion", (value) => { value.records[0]!.eventDispositionEvidence.resultConclusion = "no_contest"; }],
    ["zero votes", (value) => { value.records[0]!.eventDispositionEvidence.voteValues = { total: 0 }; }],
    ["certification", (value) => { value.records[0]!.eventDispositionEvidence.certificationStatus = "certified"; }],
    ["approval", (value) => { value.records[0]!.approved = true; }],
    ["score", (value) => { value.records[0]!.scoreEligible = true; }],
    ["publication", (value) => { value.publicationEligible = true; }],
    ["review resolution", (value) => { value.decisions[3]!.reviewer = "fabricated"; value.decisions[3]!.resolution = "accepted"; }],
    ["unknown evaluator field", (value) => { value.records[0]!.evaluatorValues.fabricatedScore = 1; }],
  ];

  it.each(semanticEscalations)("rejects a fully supplied semantic %s escalation", (_label, mutate) => {
    const source = input();
    const value = structuredClone(buildConnecticutPrimaryEvidenceReviewPackageV4(source)) as unknown as MutablePackage;
    mutate(value);
    expect(() => validateConnecticutPrimaryEvidenceReviewPackageV4(value as unknown as Package, source)).toThrow(/semantic_or_hash_drift/);
  });
});
