import { describe, expect, it } from "vitest";
import { buildAipacEvidence, projectIndependentExpenditureBulkRow, projectPas2BulkRow } from "./aipac-evidence";

const mapping = [
  { candidateId: "H0NY01001", seatCycleId: "seat_ny_01_2026", relationship: "incumbent", authorizedCommitteeIds: ["C00111111"] },
  { candidateId: "H6NY01002", seatCycleId: "seat_ny_01_2026", relationship: "democratic_primary_challenger", authorizedCommitteeIds: ["C00222222"] },
] as const;
const coverage = [2026, 2024, 2022].map((year) => ({ cycleYear: year, directContributionsComplete: true, independentExpendituresComplete: true, directContributionSnapshotIds: [`snap_pas2_${year}`], independentExpenditureSnapshotIds: [`snap_ie_${year}`] }));
const pas2 = (overrides: Record<string, unknown> = {}) => ({ snapshotId: "snap_pas2_2026", cycleYear: 2026, committeeId: "C00797670", amendmentIndicator: "N", reportType: "Q1", transactionPgi: "P2026", transactionType: "24K", transactionDate: "2026-02-01", transactionAmount: 5_000, recipientCommitteeId: "C00111111", candidateId: "H0NY01001", transactionId: "SB23", fileNumber: 100, memoCode: null, subId: "1", ...overrides });
const ie = (overrides: Record<string, unknown> = {}) => ({ snapshotId: "snap_ie_2026", cycleYear: 2026, candidateId: "H0NY01001", spenderId: "C00799031", electionType: "P2026", amount: 250_000, expenditureDate: "2026-03-01", supportOppose: "S", fileNumber: 200, amendmentIndicator: "N", transactionId: "E1", previousFileNumber: null, ...overrides });
const input = (overrides: Record<string, unknown> = {}) => ({ sourceCutoff: "2026-07-31", currentCycleYear: 2026, pas2Transactions: [pas2()], independentExpenditures: [ie()], candidateMappings: mapping, coverage, classificationSnapshotIds: ["snap_aipac_classification"], ...overrides });

describe("buildAipacEvidence", () => {
  it("projects official keyed bulk rows while dropping person and address fields", () => {
    const direct = projectPas2BulkRow({ CMTE_ID: "C00797670", AMNDT_IND: "N", RPT_TP: "Q1", TRANSACTION_PGI: "P2026", TRANSACTION_TP: "24K", TRANSACTION_DT: "02012026", TRANSACTION_AMT: "5,000.00", OTHER_ID: "C00111111", CAND_ID: "H0NY01001", TRAN_ID: "SB23", FILE_NUM: "100", MEMO_CD: "X", SUB_ID: "1", NAME: "not retained", CITY: "not retained" }, "snap_pas2_2026", 2026);
    const independent = projectIndependentExpenditureBulkRow({ CAN_ID: "H0NY01001", SPE_ID: "C00799031", ELE_TYP: "P2026", EXP_AMO: "$250,000.00", EXP_DAT: "03/01/2026", SUP_OPP: "S", FILE_NUM: "200", AMN_IND: "N", TRA_ID: "E1", PREV_FILE_NUM: "" }, "snap_ie_2026", 2026);
    expect(direct).toMatchObject({ transactionDate: "2026-02-01", transactionAmount: 5_000, memoCode: "X" });
    expect(independent).toMatchObject({ expenditureDate: "2026-03-01", amount: 250_000, previousFileNumber: null });
    expect(direct).not.toHaveProperty("NAME");
    expect(direct).not.toHaveProperty("CITY");
  });

  it("emits auditable direct and independent primary evidence", () => {
    const result = buildAipacEvidence(input());
    expect(result.evidence).toHaveLength(2);
    expect(result.evidence[0]).toMatchObject({ kind: "direct_contribution", netAmount: 5_000, recipientCandidateId: "H0NY01001", latestRevisionFileNumber: 100 });
    expect(result.evidence[1]).toMatchObject({ kind: "independent_support_incumbent", netAmount: 250_000, targetSeatCycleId: "seat_ny_01_2026", latestRevisionFileNumber: 200 });
    expect(result.inputSnapshotIds).toEqual(["snap_aipac_classification", "snap_ie_2022", "snap_ie_2024", "snap_ie_2026", "snap_pas2_2022", "snap_pas2_2024", "snap_pas2_2026"]);
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
      pas2Transactions: [pas2({ transactionId: "ADD", transactionAmount: 8_000 }), pas2({ transactionId: "REFUND", transactionAmount: -3_000, subId: "2" })],
      independentExpenditures: [],
    }));
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]).toMatchObject({ kind: "direct_contribution", netAmount: 5_000 });
    expect(result.evidence[0]!.sourceTransactionIds).toHaveLength(2);
  });

  it("rejects general-election, stale, wrong-committee, unrelated-seat, and wrong-direction records", () => {
    const result = buildAipacEvidence(input({
      pas2Transactions: [
        pas2({ transactionId: "GENERAL", transactionPgi: "G2026" }),
        pas2({ transactionId: "STALE", cycleYear: 2020, transactionPgi: "P2020" }),
        pas2({ transactionId: "OTHER", committeeId: "C00999999" }),
        pas2({ transactionId: "UNAUTHORIZED", recipientCommitteeId: "C00888888" }),
      ],
      independentExpenditures: [
        ie({ transactionId: "GENERAL", electionType: "G2026" }),
        ie({ transactionId: "WRONG_SPENDER", spenderId: "C00999999" }),
        ie({ transactionId: "OPPOSE_INCUMBENT", supportOppose: "O" }),
        ie({ transactionId: "SUPPORT_CHALLENGER", candidateId: "H6NY01002", supportOppose: "S" }),
        ie({ transactionId: "UNMAPPED", candidateId: "H6CA99999" }),
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

  it("rejects unsupported completeness claims without source snapshots", () => {
    expect(() => buildAipacEvidence(input({ coverage: [{ cycleYear: 2026, directContributionsComplete: true, independentExpendituresComplete: false, directContributionSnapshotIds: [], independentExpenditureSnapshotIds: [] }] }))).toThrow("requires a source snapshot");
  });
});
