import { createHash } from "node:crypto";

import { canonicalJson } from "../fec/aipac-proposed-packages";
import { NEW_YORK_DISPOSITION_V2_PACKAGE_SHA256, type NewYorkPrimaryDispositionsV2Receipt, validateNewYorkPrimaryDispositionsV2Receipt } from "./new-york-house-democratic-primary-dispositions-v2-receipt";
import { NEW_YORK_METRO_PRIMARY_COUNTY_AUTHORITY_PACKAGE_SHA256, NEW_YORK_METRO_PRIMARY_COUNTY_AUTHORITY_ROW_SET_SHA256, type NewYorkMetroPrimaryCountyAuthorityReceipt } from "./new-york-metro-primary-county-authority-receipt";

export const NEW_YORK_HOUSE_DEMOCRATIC_PRIMARY_DISPOSITIONS_V3 = "new-york-house-democratic-primary-dispositions-receipt-v3" as const;
export const NEW_YORK_DISPOSITION_V3_SET_SHA256 = "ddafdf0d0a161b67087041b1c678c820dda07ce3f983d05ad283a6ccb06fd544" as const;
export const NEW_YORK_DISPOSITION_V3_PACKAGE_SHA256 = "33c46131067fda45ed9b05318e59fedaf3ab73d350721acabab29768f0c32f8d" as const;

type Cycle = 2022 | 2024;
type Disposition = "reported_contest" | "certified_uncontested" | "unresolved_outside_retained_authority_scope";
type V2Row = NewYorkPrimaryDispositionsV2Receipt["rows"][number];
type CountySource = NewYorkMetroPrimaryCountyAuthorityReceipt["authorities"][number];
type CountyAuthority = Readonly<{
  parentSourceLockId: "new-york-metro-house-democratic-primary-county-authority-receipt-v1";
  authorityId: CountySource["authorityId"];
  authorityRowSha256: string;
  authoritySeatCycleId: CountySource["seatCycleId"];
  sourceContestId: CountySource["sourceContestId"];
  sourceLockIds: CountySource["sourceLockIds"];
  sourceFileSha256s: CountySource["sourceFileSha256s"];
  authorityPublisher: CountySource["authorityPublisher"];
  resultStatus: CountySource["resultStatus"];
  certificationStatus: CountySource["certificationStatus"];
  resultScope: CountySource["resultScope"];
  districtCountyFips: CountySource["districtCountyFips"];
  districtCountyNames: CountySource["districtCountyNames"];
  countyNameAuthoritySourceLockId: CountySource["countyNameAuthoritySourceLockId"];
  countyNameAuthorityFileSha256: CountySource["countyNameAuthorityFileSha256"];
  electionDistrictsReported: CountySource["electionDistrictsReported"];
  electionDistrictsTotal: CountySource["electionDistrictsTotal"];
  reportingCompleteness: CountySource["reportingCompleteness"];
}>;
type Row = Readonly<{
  seatCycleId: string;
  cycleYear: Cycle;
  stateCode: "NY";
  districtCode: string;
  party: "Democratic";
  office: "U.S. Representative";
  disposition: Disposition;
  dispositionV2ParentRowSha256: string;
  ballotCertificationSourceLockId: string;
  ballotCertificationPage: number | null;
  reportedContestId: string | null;
  localAuthority: V2Row["localAuthority"];
  countyAuthority: CountyAuthority | null;
  voteValues: null;
  evaluatorValues: Readonly<{ priorPrimaryMargin: null; priorDemocraticPrimaryVotes: null; priorProgressivePrimaryShare: null }>;
  scoreEligible: false;
  rowSha256: string;
}>;
export type NewYorkPrimaryDispositionsV3Receipt = Readonly<{
  schema: typeof NEW_YORK_HOUSE_DEMOCRATIC_PRIMARY_DISPOSITIONS_V3;
  version: 3;
  generatedAt: "2026-08-06T16:00:00.000Z";
  sourceCutoff: "2026-08-06";
  reviewerOnly: true;
  publicationEligible: false;
  review: Readonly<{ status: "proposed"; reviewer: null; reviewedAt: null; resolution: null }>;
  authorityScope: "composed state, NYC, and retained complete-county authority";
  parents: Readonly<{
    dispositionV2: Readonly<{ sourceLockId: "new-york-house-democratic-primary-dispositions-2022-2024-v2"; packageSha256: typeof NEW_YORK_DISPOSITION_V2_PACKAGE_SHA256 }>;
    countyAuthority: Readonly<{ sourceLockId: "new-york-metro-house-democratic-primary-county-authority-receipt-v1"; packageSha256: typeof NEW_YORK_METRO_PRIMARY_COUNTY_AUTHORITY_PACKAGE_SHA256; authorityRowSetSha256: typeof NEW_YORK_METRO_PRIMARY_COUNTY_AUTHORITY_ROW_SET_SHA256 }>;
  }>;
  rows: readonly Row[];
  summary: Readonly<{
    seatCycles: 52; reportedContests: 20; certifiedUncontested: 15; unresolved: 17;
    existingNycOverridesPreserved: 8; newCountyAuthorityOverrides: 1;
    reportedByCycle: Readonly<{ "2022": 15; "2024": 5 }>;
    certifiedUncontestedByCycle: Readonly<{ "2022": 4; "2024": 11 }>;
    unresolvedByCycle: Readonly<{ "2022": 7; "2024": 10 }>;
    dispositionSetSha256: string; evaluatorNumericValues: 0; scoreEligibleRows: 0;
  }>;
  limitations: readonly string[];
  unresolvedGates: readonly string[];
  packageSha256: string;
}>;

const OVERRIDE_SEAT = "ny:2024:us-house:01:democratic" as const;
const AUTHORITY_ID = "ny-metro-county-authority:2024:01:democratic" as const;
const LIMITATIONS = [
  "This v3 receipt composes two immutable reviewer candidates; it does not mutate or promote either parent.",
  "Only 2024 NY-01 changes from unresolved to reported contest because retained Census geography proves the official Suffolk final-result candidate covers the whole district.",
  "The Suffolk result is not collapsed into the state reported-result identifier, and its vote values remain in the county-authority parent.",
  "No row is public, score eligible, identity reviewed, historical-geography approved, or progressively classified.",
] as const;
const GATES = ["retain_remaining_ny_metro_county_ballot_and_result_authority", "retain_or_review_signed_suffolk_certification", "review_incumbent_candidate_identity", "review_historical_district_compatibility", "review_progressive_candidate_classification", "complete_human_data_review_and_publication_approval"] as const;
const digest = (domain: string, value: unknown) => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const fail = (code: string): never => { throw new Error(`New York primary dispositions v3 rejected: ${code}`); };
const bytewise = (a: string, b: string) => Buffer.compare(Buffer.from(a), Buffer.from(b));
const count = (rows: readonly Row[], cycle: Cycle, disposition: Disposition) => rows.filter((row) => row.cycleYear === cycle && row.disposition === disposition).length;

function validateCountyParent(value: NewYorkMetroPrimaryCountyAuthorityReceipt): CountySource {
  const { packageSha256, ...unsigned } = value;
  const row = value.authorities[0];
  if (packageSha256 !== NEW_YORK_METRO_PRIMARY_COUNTY_AUTHORITY_PACKAGE_SHA256 || packageSha256 !== digest("dsa-seats:ny-metro-primary-county-authority-package:v1\0", unsigned) || value.authorityRowSetSha256 !== NEW_YORK_METRO_PRIMARY_COUNTY_AUTHORITY_ROW_SET_SHA256 || value.authorities.length !== 1 || !row || row.authorityId !== AUTHORITY_ID || row.seatCycleId !== OVERRIDE_SEAT || row.supportedDisposition !== "reported_contest" || row.scoreEligible || Object.values(row.evaluatorValues).some((item) => item !== null)) fail("COUNTY_AUTHORITY_PARENT_INVALID");
  const { authorityRowSha256, ...rowUnsigned } = row;
  if (authorityRowSha256 !== digest("dsa-seats:ny-metro-primary-county-authority-row:v1\0", rowUnsigned)) fail("COUNTY_AUTHORITY_ROW_INVALID");
  return row;
}

export function buildNewYorkPrimaryDispositionsV3Receipt(input: Readonly<{ dispositionV2: NewYorkPrimaryDispositionsV2Receipt; countyAuthority: NewYorkMetroPrimaryCountyAuthorityReceipt }>): NewYorkPrimaryDispositionsV3Receipt {
  const parent = validateNewYorkPrimaryDispositionsV2Receipt(input.dispositionV2);
  const authority = validateCountyParent(input.countyAuthority);
  const rows: Row[] = parent.rows.map((prior) => {
    const override = prior.seatCycleId === OVERRIDE_SEAT;
    if (override && prior.disposition !== "unresolved_outside_retained_authority_scope") fail("COUNTY_OVERRIDE_PARENT_NOT_UNRESOLVED");
    const countyAuthority: CountyAuthority | null = override ? {
      parentSourceLockId: "new-york-metro-house-democratic-primary-county-authority-receipt-v1",
      authorityId: authority.authorityId,
      authorityRowSha256: authority.authorityRowSha256,
      authoritySeatCycleId: authority.seatCycleId,
      sourceContestId: authority.sourceContestId,
      sourceLockIds: authority.sourceLockIds,
      sourceFileSha256s: authority.sourceFileSha256s,
      authorityPublisher: authority.authorityPublisher,
      resultStatus: authority.resultStatus,
      certificationStatus: authority.certificationStatus,
      resultScope: authority.resultScope,
      districtCountyFips: authority.districtCountyFips,
      districtCountyNames: authority.districtCountyNames,
      countyNameAuthoritySourceLockId: authority.countyNameAuthoritySourceLockId,
      countyNameAuthorityFileSha256: authority.countyNameAuthorityFileSha256,
      electionDistrictsReported: authority.electionDistrictsReported,
      electionDistrictsTotal: authority.electionDistrictsTotal,
      reportingCompleteness: authority.reportingCompleteness,
    } : null;
    const unsigned = { seatCycleId: prior.seatCycleId, cycleYear: prior.cycleYear, stateCode: prior.stateCode, districtCode: prior.districtCode, party: prior.party, office: prior.office, disposition: override ? "reported_contest" as const : prior.disposition, dispositionV2ParentRowSha256: prior.rowSha256, ballotCertificationSourceLockId: prior.ballotCertificationSourceLockId, ballotCertificationPage: prior.ballotCertificationPage, reportedContestId: prior.reportedContestId, localAuthority: prior.localAuthority, countyAuthority, voteValues: null, evaluatorValues: { priorPrimaryMargin: null, priorDemocraticPrimaryVotes: null, priorProgressivePrimaryShare: null }, scoreEligible: false as const };
    return { ...unsigned, rowSha256: digest("dsa-seats:ny-house-democratic-primary-disposition:v3\0", unsigned) };
  });
  rows.sort((a, b) => bytewise(a.seatCycleId, b.seatCycleId));
  const dispositionSetSha256 = digest("dsa-seats:ny-house-democratic-primary-disposition-set:v3\0", rows.map(({ seatCycleId, rowSha256 }) => ({ seatCycleId, rowSha256 })));
  const unsigned = { schema: NEW_YORK_HOUSE_DEMOCRATIC_PRIMARY_DISPOSITIONS_V3, version: 3 as const, generatedAt: "2026-08-06T16:00:00.000Z" as const, sourceCutoff: "2026-08-06" as const, reviewerOnly: true as const, publicationEligible: false as const, review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null }, authorityScope: "composed state, NYC, and retained complete-county authority" as const, parents: { dispositionV2: { sourceLockId: "new-york-house-democratic-primary-dispositions-2022-2024-v2" as const, packageSha256: NEW_YORK_DISPOSITION_V2_PACKAGE_SHA256 }, countyAuthority: { sourceLockId: "new-york-metro-house-democratic-primary-county-authority-receipt-v1" as const, packageSha256: NEW_YORK_METRO_PRIMARY_COUNTY_AUTHORITY_PACKAGE_SHA256, authorityRowSetSha256: NEW_YORK_METRO_PRIMARY_COUNTY_AUTHORITY_ROW_SET_SHA256 } }, rows, summary: { seatCycles: 52 as const, reportedContests: 20 as const, certifiedUncontested: 15 as const, unresolved: 17 as const, existingNycOverridesPreserved: 8 as const, newCountyAuthorityOverrides: 1 as const, reportedByCycle: { "2022": 15 as const, "2024": 5 as const }, certifiedUncontestedByCycle: { "2022": 4 as const, "2024": 11 as const }, unresolvedByCycle: { "2022": 7 as const, "2024": 10 as const }, dispositionSetSha256, evaluatorNumericValues: 0 as const, scoreEligibleRows: 0 as const }, limitations: LIMITATIONS, unresolvedGates: GATES };
  return { ...unsigned, packageSha256: digest("dsa-seats:ny-house-democratic-primary-disposition-package:v3\0", unsigned) };
}

export function validateNewYorkPrimaryDispositionsV3Receipt(value: NewYorkPrimaryDispositionsV3Receipt): NewYorkPrimaryDispositionsV3Receipt {
  const { packageSha256, ...unsigned } = value;
  const setHash = digest("dsa-seats:ny-house-democratic-primary-disposition-set:v3\0", value.rows.map(({ seatCycleId, rowSha256 }) => ({ seatCycleId, rowSha256 })));
  const ids = value.rows.map((row) => row.seatCycleId);
  const countyRows = value.rows.filter((row) => row.countyAuthority !== null);
  const localRows = value.rows.filter((row) => row.localAuthority !== null);
  if (packageSha256 !== NEW_YORK_DISPOSITION_V3_PACKAGE_SHA256 || packageSha256 !== digest("dsa-seats:ny-house-democratic-primary-disposition-package:v3\0", unsigned) || setHash !== NEW_YORK_DISPOSITION_V3_SET_SHA256 || value.summary.dispositionSetSha256 !== setHash || value.rows.length !== 52 || new Set(ids).size !== 52 || countyRows.length !== 1 || countyRows[0]?.seatCycleId !== OVERRIDE_SEAT || localRows.length !== 8 || count(value.rows, 2022, "reported_contest") !== 15 || count(value.rows, 2024, "reported_contest") !== 5 || count(value.rows, 2022, "certified_uncontested") !== 4 || count(value.rows, 2024, "certified_uncontested") !== 11 || count(value.rows, 2022, "unresolved_outside_retained_authority_scope") !== 7 || count(value.rows, 2024, "unresolved_outside_retained_authority_scope") !== 10 || value.summary.evaluatorNumericValues !== 0 || value.summary.scoreEligibleRows !== 0 || value.reviewerOnly !== true || value.publicationEligible !== false || canonicalJson(value.limitations) !== canonicalJson(LIMITATIONS) || canonicalJson(value.unresolvedGates) !== canonicalJson(GATES) || value.rows.some((row) => { const { rowSha256, ...rest } = row; return rowSha256 !== digest("dsa-seats:ny-house-democratic-primary-disposition:v3\0", rest) || row.voteValues !== null || row.scoreEligible || Object.values(row.evaluatorValues).some((item) => item !== null) || (row.countyAuthority !== null && (row.disposition !== "reported_contest" || row.reportedContestId !== null || row.countyAuthority.authoritySeatCycleId !== row.seatCycleId || row.countyAuthority.sourceContestId === row.reportedContestId || row.countyAuthority.authorityId !== AUTHORITY_ID)); })) fail("PACKAGE_INVARIANT_INVALID");
  return value;
}
