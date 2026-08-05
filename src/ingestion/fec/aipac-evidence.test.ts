import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildAipacEvidence, projectIndependentExpenditureBulkRow, projectPas2BulkRow } from "./aipac-evidence";

const mapping = [
  { candidateId: "H0NY01001", seatCycleId: "seat_ny_01_2026", relationship: "incumbent", authorizedCommitteeIds: ["C00111111"], effectiveCycleYears: [2022, 2024, 2026], mappingSnapshotId: "snap_mapping", mappingArtifactSha256: "b".repeat(64), reviewId: "review_1", reviewedAt: "2026-07-31" },
  { candidateId: "H6NY01002", seatCycleId: "seat_ny_01_2026", relationship: "democratic_primary_challenger", authorizedCommitteeIds: ["C00222222"], effectiveCycleYears: [2026], mappingSnapshotId: "snap_mapping", mappingArtifactSha256: "b".repeat(64), reviewId: "review_1", reviewedAt: "2026-07-31" },
] as const;
const artifactSha256 = "a".repeat(64);
const identity = (domain: string, value: string) => createHash("sha256").update(domain, "ascii").update(value, "utf8").digest("hex");
const coverage = [2026, 2024, 2022].map((year) => ({ cycleYear: year, directContributionsComplete: true, independentExpendituresComplete: true, directContributionSnapshotIds: [`snap_pas2_${year}`], independentExpenditureSnapshotIds: [`snap_ie_${year}`], directContributionArtifactSha256s: [artifactSha256], independentExpenditureArtifactSha256s: [artifactSha256] }));
const pas2 = (overrides: Record<string, unknown> = {}) => ({ snapshotId: "snap_pas2_2026", cycleYear: 2026, committeeId: "C00797670", amendmentIndicator: "N", reportType: "Q1", transactionPgi: "P2026", transactionType: "24K", transactionDate: "2026-02-01", filingReceiptDate: "2026-02-05", transactionAmount: 5_000, recipientCommitteeId: "C00111111", candidateId: "H0NY01001", transactionIdSha256: identity("fec-aipac-pas2:transaction-id:v1\0", "SB23"), fileNumber: 100, memoCode: null, subId: "1", ...overrides });
const ie = (overrides: Record<string, unknown> = {}) => ({ snapshotId: "snap_ie_2026", cycleYear: 2026, candidateId: "H0NY01001", spenderId: "C00799031", electionType: "P2026", amount: 250_000, expenditureDate: "2026-03-01", filingReceiptDate: "2026-03-05", supportOppose: "S", fileNumber: 200, amendmentIndicator: "N", transactionIdSha256: identity("fec-udp-schedule-e:transaction-id:v1\0", "E1"), previousFileNumber: null, ...overrides });
const input = (overrides: Record<string, unknown> = {}) => ({ sourceCutoff: "2026-07-31", currentCycleYear: 2026, pas2Transactions: [pas2()], independentExpenditures: [ie()], candidateMappings: mapping, coverage, classificationSnapshotIds: ["snap_aipac_classification"], ...overrides });

describe("buildAipacEvidence", () => {
  it("projects official keyed bulk rows while dropping person and address fields", () => {
    const direct = projectPas2BulkRow({ CMTE_ID: "C00797670", AMNDT_IND: "N", RPT_TP: "Q1", TRANSACTION_PGI: "P2026", TRANSACTION_TP: "24K", TRANSACTION_DT: "02012026", TRANSACTION_AMT: "5,000.00", OTHER_ID: "C00111111", CAND_ID: "H0NY01001", TRAN_ID: "SB23", FILE_NUM: "100", MEMO_CD: "X", SUB_ID: "1", NAME: "not retained", CITY: "not retained" }, "snap_pas2_2026", 2026, "2026-02-05");
    const independent = projectIndependentExpenditureBulkRow({ cand_id: "H0NY01001", spe_id: "C00799031", ele_type: "P", fec_election_yr: "2026", exp_amo: "$250,000.00", exp_date: "03/01/2026", sup_opp: "S", file_num: "200", amndt_ind: "A1", tran_id: "E1", receipt_dat: "05-MAR-26", prev_file_num: "199" }, "snap_ie_2026", 2026);
    expect(direct).toMatchObject({ transactionDate: "2026-02-01", filingReceiptDate: "2026-02-05", transactionAmount: 5_000, memoCode: "X", transactionIdSha256: identity("fec-aipac-pas2:transaction-id:v1\0", "SB23") });
    expect(independent).toMatchObject({ electionType: "P2026", expenditureDate: "2026-03-01", filingReceiptDate: "2026-03-05", amount: 250_000, amendmentIndicator: "A", previousFileNumber: 199, transactionIdSha256: identity("fec-udp-schedule-e:transaction-id:v1\0", "E1") });
    expect(direct).not.toHaveProperty("NAME");
    expect(direct).not.toHaveProperty("CITY");
  });

  it("emits auditable direct and independent primary evidence", () => {
    const result = buildAipacEvidence(input());
    expect(result.evidence).toHaveLength(2);
    expect(result.evidence[0]).toMatchObject({ kind: "direct_contribution", netAmount: 5_000, recipientCandidateId: "H0NY01001", latestRevisionFileNumber: 100 });
    expect(result.evidence[1]).toMatchObject({ kind: "independent_support_incumbent", netAmount: 250_000, targetSeatCycleId: "seat_ny_01_2026", latestRevisionFileNumber: 200 });
    expect(result.inputSnapshotIds).toEqual(["snap_aipac_classification", "snap_ie_2022", "snap_ie_2024", "snap_ie_2026", "snap_mapping", "snap_pas2_2022", "snap_pas2_2024", "snap_pas2_2026"]);
  });

  it("uses only the latest amendment and omits a reversed or net-zero group", () => {
    const result = buildAipacEvidence(input({
      pas2Transactions: [pas2(), pas2({ amendmentIndicator: "A", fileNumber: 101, transactionAmount: -5_000, subId: "2" })],
      independentExpenditures: [ie(), ie({ amendmentIndicator: "A", fileNumber: 201, amount: -250_000, previousFileNumber: 200 })],
    }));
    expect(result.evidence).toEqual([]);
  });

  it("nets distinct latest transaction identities within the same candidate relationship", () => {
    const result = buildAipacEvidence(input({
      pas2Transactions: [pas2({ transactionIdSha256: identity("fec-aipac-pas2:transaction-id:v1\0", "ADD"), transactionAmount: 8_000 }), pas2({ transactionIdSha256: identity("fec-aipac-pas2:transaction-id:v1\0", "REFUND"), transactionAmount: -3_000, subId: "2" })],
      independentExpenditures: [],
    }));
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]).toMatchObject({ kind: "direct_contribution", netAmount: 5_000 });
    expect(result.evidence[0]!.sourceTransactionIdSha256s).toHaveLength(2);
  });

  it("rejects general-election, stale, wrong-committee, unrelated-seat, and wrong-direction records", () => {
    const result = buildAipacEvidence(input({
      pas2Transactions: [
        pas2({ transactionIdSha256: identity("fec-aipac-pas2:transaction-id:v1\0", "GENERAL"), transactionPgi: "G2026" }),
        pas2({ transactionIdSha256: identity("fec-aipac-pas2:transaction-id:v1\0", "STALE"), cycleYear: 2020, transactionPgi: "P2020" }),
        pas2({ transactionIdSha256: identity("fec-aipac-pas2:transaction-id:v1\0", "OTHER"), committeeId: "C00999999" }),
        pas2({ transactionIdSha256: identity("fec-aipac-pas2:transaction-id:v1\0", "UNAUTHORIZED"), recipientCommitteeId: "C00888888" }),
      ],
      independentExpenditures: [
        ie({ transactionIdSha256: identity("fec-udp-schedule-e:transaction-id:v1\0", "GENERAL"), electionType: "G2026" }),
        ie({ transactionIdSha256: identity("fec-udp-schedule-e:transaction-id:v1\0", "WRONG_SPENDER"), spenderId: "C00999999" }),
        ie({ transactionIdSha256: identity("fec-udp-schedule-e:transaction-id:v1\0", "OPPOSE_INCUMBENT"), supportOppose: "O" }),
        ie({ transactionIdSha256: identity("fec-udp-schedule-e:transaction-id:v1\0", "SUPPORT_CHALLENGER"), candidateId: "H6NY01002", supportOppose: "S" }),
        ie({ transactionIdSha256: identity("fec-udp-schedule-e:transaction-id:v1\0", "UNMAPPED"), candidateId: "H6CA99999" }),
      ],
    }));
    expect(result.evidence).toEqual([]);
  });

  it("qualifies UDP opposition only for a mapped same-seat Democratic primary challenger", () => {
    const result = buildAipacEvidence(input({ pas2Transactions: [], independentExpenditures: [ie({ candidateId: "H6NY01002", supportOppose: "O" })] }));
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]).toMatchObject({ kind: "independent_oppose_challenger", targetCandidateId: "H6NY01002", targetSeatCycleId: "seat_ny_01_2026" });
  });

  it("requires the versioned AIPAC-network classification snapshot for UDP evidence", () => {
    expect(() => buildAipacEvidence(input({ classificationSnapshotIds: [] }))).toThrow("FEC_AIPAC_NETWORK_CLASSIFICATION_SNAPSHOT_MISSING");
  });

  it("fails closed on conflicting rows at the same revision", () => {
    expect(() => buildAipacEvidence(input({ pas2Transactions: [pas2(), pas2({ transactionAmount: 6_000, subId: "2" })] }))).toThrow("FEC_AIPAC_REVISION_CONFLICT");
  });

  it("does not retain a PAS2 primary transaction when its latest revision changes election context", () => {
    const result = buildAipacEvidence(input({
      pas2Transactions: [pas2(), pas2({ amendmentIndicator: "A", fileNumber: 101, transactionPgi: "G2026", subId: "2" })],
      independentExpenditures: [],
    }));
    expect(result.evidence).toEqual([]);
  });

  it("uses the terminal independent-expenditure filing when an amendment changes candidate or election context", () => {
    const result = buildAipacEvidence(input({
      pas2Transactions: [],
      independentExpenditures: [ie(), ie({ amendmentIndicator: "A", fileNumber: 201, previousFileNumber: 200, electionType: "G2026", candidateId: "H6CA99999" })],
    }));
    expect(result.evidence).toEqual([]);
  });

  it("fails closed when an independent-expenditure amendment chain is incomplete", () => {
    expect(() => buildAipacEvidence(input({ independentExpenditures: [ie({ amendmentIndicator: "A", fileNumber: 201, previousFileNumber: 200 })] }))).toThrow("FEC_AIPAC_IE_AMENDMENT_CHAIN_INCOMPLETE");
  });

  it("excludes post-cutoff filings even when the underlying transaction predates the cutoff", () => {
    const result = buildAipacEvidence(input({
      pas2Transactions: [pas2({ filingReceiptDate: "2026-08-01" })],
      independentExpenditures: [ie({ filingReceiptDate: "2026-08-01" })],
    }));
    expect(result.evidence).toEqual([]);
  });

  it("rejects unsupported completeness claims without source snapshots", () => {
    expect(() => buildAipacEvidence(input({ coverage: [{ cycleYear: 2026, directContributionsComplete: true, independentExpendituresComplete: false, directContributionSnapshotIds: [], independentExpenditureSnapshotIds: [], directContributionArtifactSha256s: [], independentExpenditureArtifactSha256s: [] }] }))).toThrow("requires a source snapshot and artifact hash");
  });
});
