import type { FecPageReceipt, FecSanitizedEnvelopeV1 } from "./envelope";
import { FEC_SANITIZED_ADAPTER_VERSION, fecPageRequestSha256 } from "./envelope";

const query = (
  endpoint: FecPageReceipt["endpoint"],
  page: number,
): FecPageReceipt["query"] => {
  if (endpoint === "committee_reports")
    return [
      { key: "committee_id", value: "C00000001" },
      { key: "cycle", value: "2024" },
      { key: "max_receipt_date", value: "2024-12-31" },
      { key: "page", value: String(page) },
      { key: "per_page", value: "100" },
      { key: "sort", value: "-receipt_date" },
    ];
  if (endpoint === "schedule_e_by_candidate")
    return [
      { key: "candidate_id", value: "H00000001" },
      { key: "cycle", value: "2024" },
      { key: "election_full", value: "false" },
      { key: "page", value: String(page) },
      { key: "per_page", value: "100" },
    ];
  return [
    { key: "cycle", value: "2024" },
    { key: "page", value: String(page) },
    { key: "per_page", value: "100" },
  ];
};

const path = (endpoint: FecPageReceipt["endpoint"]): string => {
  if (endpoint === "candidate_committees")
    return "/v1/candidate/H00000001/committees/";
  if (endpoint === "committee_reports") return "/v1/reports/house-senate/";
  return "/v1/schedules/schedule_e/by_candidate/";
};

const pages = (
  endpoint: FecPageReceipt["endpoint"],
): readonly FecPageReceipt[] =>
  [1, 2].map((page) => ({
    endpoint,
    path: path(endpoint),
    query: query(endpoint, page),
    page,
    perPage: 100,
    reportedCount: 1,
    reportedPages: 1,
    countExact: true,
    requestSha256: fecPageRequestSha256(path(endpoint), query(endpoint, page)),
    responseSha256: (page === 1 ? "b" : "c").repeat(64),
    responseByteSize: page === 1 ? 100 : 50,
    resultCount: page === 1 ? 1 : 0,
    isFirstPage: page === 1,
    isLastPage: page === 2,
  }));

export function fecEnvelopeFixture(): FecSanitizedEnvelopeV1 {
  return {
    schemaVersion: 1,
    adapterVersion: FEC_SANITIZED_ADAPTER_VERSION,
    sourceLockSha256: "a".repeat(64),
    releaseCutoff: "2024-12-31",
    candidateId: "H00000001",
    electionCycle: 2024,
    electionKey: "2024-ca-01-general",
    financeScope: {
      reportForm: "F3",
      reportType: "YE",
      coverageStartDate: "2024-01-01",
      coverageEndDate: "2024-12-31",
      asOf: "2024-12-31",
      cutoff: "2024-12-31",
    },
    mapping: {
      candidateId: "H00000001",
      electionCycle: 2024,
      candidacyId: "candidacy",
      seatCycleId: "seat",
      snapshotId: "mapping",
      committees: [
        {
          committeeId: "C00000001",
          relationshipType: "principal_campaign_committee",
          effectiveFrom: "2024-01-01",
          effectiveTo: null,
        },
      ],
    },
    committees: [
      {
        committeeId: "C00000001",
        name: "Committee",
        designation: "P",
        committeeType: "H",
        cycles: [2024],
      },
    ],
    reports: [
      {
        candidateId: "H00000001",
        electionCycle: 2024,
        committeeId: "C00000001",
        reportForm: "F3",
        reportType: "YE",
        coverageStartDate: "2024-01-01",
        coverageEndDate: "2024-12-31",
        receiptDate: "2024-12-31",
        fileNumber: 1,
        previousFileNumber: null,
        amendmentIndicator: "N",
        amendmentChain: [1],
        mostRecent: true,
        mostRecentFileNumber: 1,
        cashOnHandEndPeriod: "1.00",
        totalReceiptsYtd: "2.00",
        totalDisbursementsYtd: "1.00",
      },
    ],
    candidateTotalsStatus: "not_collected_historical_cutoff_unsupported",
    outsideSpending: [
      {
        candidateId: "H00000001",
        committeeId: "C00000002",
        cycle: 2024,
        disposition: "support",
        electionFull: false,
        amount: "3.00",
      },
    ],
    pageReceipts: [
      ...pages("candidate_committees"),
      ...pages("committee_reports"),
      ...pages("schedule_e_by_candidate"),
    ],
    noRetention: {
      originalBodiesNotStored: true,
      secretUrlsNotStored: true,
      originalBodiesNotLogged: true,
      originalBodiesNotCached: true,
      originalBodiesNotQuarantined: true,
    },
    completeness: {
      committees: {
        complete: true,
        pageCount: 2,
        firstPagePresent: true,
        lastPagePresent: true,
      },
      reports: {
        complete: true,
        pageCount: 2,
        firstPagePresent: true,
        lastPagePresent: true,
      },
      scheduleE: {
        complete: true,
        pageCount: 2,
        firstPagePresent: true,
        lastPagePresent: true,
      },
    },
  };
}

export function fecEnvelopeWithoutAuthorizedCommittee(): FecSanitizedEnvelopeV1 {
  const value = fecEnvelopeFixture();
  return {
    ...value,
    mapping: { ...value.mapping, committees: [] },
    reports: [],
    pageReceipts: value.pageReceipts.filter(
      (page) => page.endpoint !== "committee_reports",
    ),
    completeness: {
      ...value.completeness,
      reports: {
        complete: true,
        pageCount: 0,
        firstPagePresent: false,
        lastPagePresent: false,
      },
    },
  };
}
