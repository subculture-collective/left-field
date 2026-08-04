import { describe, expect, it } from "vitest";
import { DSA_ROUTE_WEIGHTS, evaluateDsaTarget } from "./dsa-target-evaluator";

const complete = {
  metadata: { seatCycleId: "seat_house_ny_00_current", incumbentFecCandidateId: "H6NY00001", sourceCutoff: "2026-08-04", currentCycleYear: 2026, inputSnapshotIds: ["release-snapshot"] },
  seat: { chamber: "house", officeKind: "house_voting", electionType: "regular", occupancy: "occupied", incumbentParty: "democratic" },
  electoral: { presidentialDemocraticMargins: [
    { year: 2020, marginPoints: 24, observedAt: "2026-08-01", inputSnapshotIds: ["release-snapshot"], geographyCompatibility: "current_boundary_compatible" },
    { year: 2024, marginPoints: 28, observedAt: "2026-08-01", inputSnapshotIds: ["release-snapshot"], geographyCompatibility: "current_boundary_compatible" },
  ] },
  feasibility: {
    priorPrimaryMarginPoints: { kind: "value", value: 12, observedAt: "2026-08-01", inputSnapshotIds: ["release-snapshot"], methodologyVersion: "primary-margin-v1" },
    incumbentCashOnHand: { kind: "value", value: 500_000, observedAt: "2026-08-01", inputSnapshotIds: ["release-snapshot"], methodologyVersion: "fec-cash-v1" },
    incumbentTenureYears: { kind: "value", value: 8, observedAt: "2026-08-01", inputSnapshotIds: ["release-snapshot"], methodologyVersion: "tenure-v1" },
    filingRunwayDays: { kind: "value", value: 240, observedAt: "2026-08-01", inputSnapshotIds: ["release-snapshot"], methodologyVersion: "filing-runway-v1" },
    priorDemocraticPrimaryVotes: { kind: "value", value: 85_000, observedAt: "2026-08-01", inputSnapshotIds: ["release-snapshot"], methodologyVersion: "primary-turnout-v1" },
    priorProgressivePrimaryShare: { kind: "value", value: 32, observedAt: "2026-08-01", inputSnapshotIds: ["release-snapshot"], methodologyVersion: "progressive-share-v1" },
  },
  aipac: { evidence: [], coverage: [
    { cycleYear: 2022, directContributionsComplete: true, independentExpendituresComplete: true, directContributionSnapshotIds: ["release-snapshot"], independentExpenditureSnapshotIds: ["release-snapshot"] },
    { cycleYear: 2024, directContributionsComplete: true, independentExpendituresComplete: true, directContributionSnapshotIds: ["release-snapshot"], independentExpenditureSnapshotIds: ["release-snapshot"] },
    { cycleYear: 2026, directContributionsComplete: true, independentExpendituresComplete: true, directContributionSnapshotIds: ["release-snapshot"], independentExpenditureSnapshotIds: ["release-snapshot"] },
  ] },
} as const;

describe("DSA primary target evaluator", () => {
  it("qualifies a historically deep-blue Democratic seat without AIPAC evidence", () => {
    const result = evaluateDsaTarget(complete);
    expect(result).toMatchObject({ status: "qualified", selectedRoute: "deep_blue", inferredFromPartialCoverage: false });
    expect(result.components.blueBaseline).toEqual({ score: 76, floor: 24, coverage: 1, inferred: false });
    expect(result.targetScore).toBeGreaterThan(60);
  });

  it("makes documented AIPAC support the dominant signal for a generally blue seat", () => {
    const result = evaluateDsaTarget({
      ...complete,
      electoral: { presidentialDemocraticMargins: complete.electoral.presidentialDemocraticMargins.map((row) => ({ ...row, marginPoints: row.year === 2020 ? 11 : 13 })) },
      aipac: { ...complete.aipac, evidence: [
        { committeeId: "C00797670", kind: "direct_contribution", netAmount: 10_000, cycleYear: 2026, observedAt: "2026-07-01", inputSnapshotIds: ["release-snapshot"], sourceTransactionIds: ["aipac-direct-1"], latestRevisionFileNumber: 1, revisionStatus: "latest_net_positive", recipientCommitteeId: "C00900001", recipientCandidateId: "H6NY00001", recipientRelationship: "authorized" },
        { committeeId: "C00799031", kind: "independent_support_incumbent", netAmount: 750_000, cycleYear: 2026, observedAt: "2026-07-15", inputSnapshotIds: ["release-snapshot"], sourceTransactionIds: ["udp-ie-1"], latestRevisionFileNumber: 2, revisionStatus: "latest_net_positive", targetCandidateId: "H6NY00001", targetSeatCycleId: "seat_house_ny_00_current", electionType: "primary", supportOppose: "S", targetRelationship: "incumbent", networkClassificationId: "org-classification-aipac-network-v1", classificationSnapshotIds: ["release-snapshot"] },
      ] },
    });
    expect(DSA_ROUTE_WEIGHTS.aipac.aipacSupport).toBe(60);
    expect(result).toMatchObject({ status: "qualified", selectedRoute: "aipac_supported_blue" });
    expect(result.components.aipacSupport.score).toBeGreaterThan(95);
    expect(result.routeScores.deepBlue).toBeNull();
  });

  it("does not let AIPAC evidence qualify a red or toss-up district", () => {
    const result = evaluateDsaTarget({
      ...complete,
      electoral: { presidentialDemocraticMargins: complete.electoral.presidentialDemocraticMargins.map((row) => ({ ...row, marginPoints: 4 })) },
      aipac: { ...complete.aipac, evidence: [{ committeeId: "C00799031", kind: "independent_oppose_challenger", netAmount: 2_000_000, cycleYear: 2026, observedAt: "2026-07-15", inputSnapshotIds: ["release-snapshot"], sourceTransactionIds: ["udp-ie-2"], latestRevisionFileNumber: 3, revisionStatus: "latest_net_positive", targetCandidateId: "H6NY00002", targetSeatCycleId: "seat_house_ny_00_current", electionType: "primary", supportOppose: "O", targetRelationship: "democratic_primary_challenger", networkClassificationId: "org-classification-aipac-network-v1", classificationSnapshotIds: ["release-snapshot"] }] },
    });
    expect(result).toMatchObject({ status: "not_qualified", selectedRoute: null, targetScore: null });
  });

  it("allows a marked partial inference while penalizing missing feasibility coverage", () => {
    const missing = { kind: "missing", reason: "not_collected" } as const;
    const result = evaluateDsaTarget({
      ...complete,
      electoral: { presidentialDemocraticMargins: [complete.electoral.presidentialDemocraticMargins[1]] },
      feasibility: { priorPrimaryMarginPoints: missing, incumbentCashOnHand: complete.feasibility.incumbentCashOnHand, incumbentTenureYears: missing, filingRunwayDays: missing, priorDemocraticPrimaryVotes: missing, priorProgressivePrimaryShare: missing },
    });
    expect(result).toMatchObject({ status: "qualified", selectedRoute: "deep_blue", inferredFromPartialCoverage: true });
    expect(result.components.blueBaseline.coverage).toBe(0.5);
    expect(result.components.primaryFeasibility.coverage).toBe(0.2);
    expect(result.dataCoverage).toBeLessThan(0.5);
  });

  it("rejects unsupported committee relationships, duplicate years, and future evidence", () => {
    expect(() => evaluateDsaTarget({ ...complete, aipac: { ...complete.aipac, evidence: [{ committeeId: "C00799031", kind: "direct_contribution", netAmount: 5_000, cycleYear: 2026, observedAt: "2026-07-01", inputSnapshotIds: ["release-snapshot"], sourceTransactionIds: ["bad"], latestRevisionFileNumber: 1, revisionStatus: "latest_net_positive", recipientCommitteeId: "C00900001", recipientCandidateId: "H6NY00001", recipientRelationship: "authorized" }] } })).toThrow();
    expect(() => evaluateDsaTarget({ ...complete, electoral: { presidentialDemocraticMargins: [complete.electoral.presidentialDemocraticMargins[0], complete.electoral.presidentialDemocraticMargins[0]] } })).toThrow("unique");
    expect(() => evaluateDsaTarget({ ...complete, aipac: { ...complete.aipac, evidence: [{ committeeId: "C00797670", kind: "direct_contribution", netAmount: 5_000, cycleYear: 2026, observedAt: "2026-08-05", inputSnapshotIds: ["release-snapshot"], sourceTransactionIds: ["future"], latestRevisionFileNumber: 1, revisionStatus: "latest_net_positive", recipientCommitteeId: "C00900001", recipientCandidateId: "H6NY00001", recipientRelationship: "authorized" }] } })).toThrow("source cutoff");
  });

  it("keeps absent AIPAC evidence unknown until all required cycles and channels are collected", () => {
    const result = evaluateDsaTarget({ ...complete, aipac: { evidence: [], coverage: [{ cycleYear: 2026, directContributionsComplete: false, independentExpendituresComplete: true, directContributionSnapshotIds: [], independentExpenditureSnapshotIds: ["release-snapshot"] }] } });
    expect(result.components.aipacSupport).toMatchObject({ score: null, missingReason: "not_collected", inferred: true });
  });

  it("rejects unrelated candidate evidence and presidential margins outside 2020/2024", () => {
    const unrelated = { committeeId: "C00797670", kind: "direct_contribution", netAmount: 10_000, cycleYear: 2026, observedAt: "2026-07-01", inputSnapshotIds: ["release-snapshot"], sourceTransactionIds: ["other-candidate"], latestRevisionFileNumber: 1, revisionStatus: "latest_net_positive", recipientCommitteeId: "C00900002", recipientCandidateId: "H6CA00001", recipientRelationship: "authorized" } as const;
    expect(() => evaluateDsaTarget({ ...complete, aipac: { ...complete.aipac, evidence: [unrelated] } })).toThrow("incumbent candidate");
    expect(() => evaluateDsaTarget({ ...complete, electoral: { presidentialDemocraticMargins: [{ ...complete.electoral.presidentialDemocraticMargins[0], year: 2016 }] } })).toThrow("Only compatible 2020 and 2024");
    expect(() => evaluateDsaTarget({ ...complete, aipac: { ...complete.aipac, evidence: [{ ...unrelated, recipientCandidateId: "H6NY00001", cycleYear: 2020 }] } })).toThrow("current or two prior cycles");
  });

  it("requires snapshot proof before a coverage channel can be called complete", () => {
    expect(() => evaluateDsaTarget({ ...complete, aipac: { evidence: [], coverage: [{ cycleYear: 2026, directContributionsComplete: true, independentExpendituresComplete: false, directContributionSnapshotIds: [], independentExpenditureSnapshotIds: [] }] } })).toThrow("requires a source snapshot");
  });
});
