import { createHash } from "node:crypto";

import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateDsaTargetIncumbentRoster } from "../identity/incumbent-tenure-factual-candidate";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import { validateNycCertifiedResultsReceipt } from "./new-york-city-house-democratic-primary-certified-results-receipt";
import { validateNewYorkPrimaryDispositionsV2Receipt } from "./new-york-house-democratic-primary-dispositions-v2-receipt";
import { validateNewYorkReportedResultsReceipt } from "./new-york-house-democratic-primary-reported-results-receipt";

export const NEW_YORK_PRIMARY_IDENTITY_V1 =
  "new-york-current-incumbent-primary-linkage-candidate-v1" as const;
export const NEW_YORK_PRIMARY_IDENTITY_OBSERVATION_SET_SHA256 = "b62cb6048e08fc09a0e983b50d2ac36d7b0ad5e1efb3ca3bc43f00e5f0220768";
export const NEW_YORK_PRIMARY_IDENTITY_PACKAGE_SHA256 = "193cf7041b027d542f6a72a9a40bc356f8ba3e502d1b61db7e85440df51418fe";

const INPUTS = {
  rosterFile: "8ae9bb3423e6160d00b5395186c42550e28811b817a482650875d87de71079e1",
  rosterPackage: "cf068848595dee99882ae74a6bef2b76061597fe0daa3c86b30c71bdcae18fee",
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  houseFile: "4ccea8259aff2df6a175545e45bdac2dfcdf0085a9cc7ab6c46aa80527bc524b",
  congressFile: "bc48cccd12df96164e5a2415fc41e838ca255fe85c297731515529692f7982cf",
  dispositionsFile: "33520e143126e6e706222e00db9818ef43349ce2d2ce5e6c3424a3fead45dacf",
  dispositionsPackage: "708fb98844ecbb3664a10be938459d93e487cf2a7c16cc4e0ae573f4361de645",
  dispositionsSet: "e1bbe206bf5d2e10d16e1e6fdfafbf296eb4d50221b51904e5f4ec3007b9f6fb",
  statewideFile: "e9ba0cfb9961d4dc71123bba78ab949b8090eceb7684b8fbf87caca196b712f2",
  statewidePackage: "5ba3280bd2a837281877a0fb70979b42501afd6e7e9d8567149e1b22942e125b",
  statewideSet: "f0b4ebcae9dee7cb689503dc9a4532d140e963c3df2dcc9ebbdd1cef358447d6",
  nycFile: "69b43917b1fac9b7632ec64ad32cc6abed08d73d7113542f3f4c5ca4ccfcf223",
  nycPackage: "4bee26afe8ba815659bd45331aa72963043c78f3f6b61b7f63fdd479165732e3",
  nycSet: "fc4dc4bbe36e4e1d44369f314e430d9b1e8d7a69b7e598d4966a7adc355d2212",
} as const;

const TARGETS = [
  ["03", "S001201", "Thomas R. Suozzi"], ["04", "G000602", "Laura Gillen"],
  ["05", "M001137", "Gregory W. Meeks"], ["06", "M001188", "Grace Meng"],
  ["07", "V000081", "Nydia M. Velázquez"], ["08", "J000294", "Hakeem S. Jeffries"],
  ["09", "C001067", "Yvette D. Clarke"], ["10", "G000599", "Daniel S. Goldman"],
  ["12", "N000002", "Jerrold Nadler"], ["13", "E000297", "Adriano Espaillat"],
  ["14", "O000172", "Alexandria Ocasio-Cortez"], ["15", "T000486", "Ritchie Torres"],
  ["16", "L000606", "George Latimer"], ["18", "R000579", "Patrick Ryan"],
  ["19", "R000622", "Josh Riley"], ["20", "T000469", "Paul Tonko"],
  ["22", "M001231", "John W. Mannion"], ["25", "M001206", "Joseph D. Morelle"],
  ["26", "K000402", "Timothy M. Kennedy"],
] as const;
const GATES = [
  "retain_remaining_county_ballot_and_result_authority",
  "review_incumbent_candidate_identity",
  "review_historical_district_compatibility",
  "review_progressive_candidate_classification",
  "complete_human_data_review_and_publication_approval",
] as const;
const LOCK_PARENTS = {
  roster: ["congress-legislators-current-20260804", "dsa-target-factual-projection-20260804-v1"],
  proposal: ["dsa-target-factual-projection-20260804-v1", "dsa-target-incumbent-roster-20260804-v1", "fec-2026-congressional-primary-dates", "geo-national-cd119"],
  house: [], congress: [],
  dispositions: ["new-york-house-democratic-primary-dispositions-2022-2024-v1", "new-york-city-house-democratic-primary-certified-results-2022-2024-v1"],
  statewide: ["ny-2022-house-primary-official-results-document", "ny-2024-house-primary-official-results-document", "ny-2022-house-democratic-primary-cd-03-contest-258", "ny-2022-house-democratic-primary-cd-16-contest-259", "ny-2022-house-democratic-primary-cd-17-contest-260", "ny-2022-house-democratic-primary-cd-18-contest-263", "ny-2022-house-democratic-primary-cd-19-contest-264", "ny-2022-house-democratic-primary-cd-20-contest-265", "ny-2022-house-democratic-primary-cd-21-contest-266", "ny-2022-house-democratic-primary-cd-22-contest-267", "ny-2022-house-democratic-primary-cd-26-contest-271", "ny-2024-house-democratic-primary-cd-16-contest-5580", "ny-2024-house-democratic-primary-cd-22-contest-5567", "house-democratic-primary-source-selection-proposal-20260804-v1"],
  nyc: ["nyc-2022-house-democratic-primary-cd-07-certified-recap", "nyc-2022-house-democratic-primary-cd-08-certified-recap", "nyc-2022-house-democratic-primary-cd-10-certified-recap", "nyc-2022-house-democratic-primary-cd-11-certified-recap", "nyc-2022-house-democratic-primary-cd-12-certified-recap", "nyc-2022-house-democratic-primary-cd-13-certified-recap", "nyc-2024-house-democratic-primary-cd-10-certified-recap", "nyc-2024-house-democratic-primary-cd-14-certified-recap"],
} as const;
const OUTPUT_PARENTS = ["dsa-target-incumbent-roster-20260804-v1", "house-democratic-primary-source-selection-proposal-20260804-v1", "house-xml", "congress-legislators-current-20260804", "new-york-house-democratic-primary-dispositions-2022-2024-v2", "new-york-house-democratic-primary-reported-results-2022-2024-v1", "new-york-city-house-democratic-primary-certified-results-2022-2024-v1"] as const;
const OUTPUT_FILE_SHA256 = "094eccb9a8c9e14a22cc3133d92775fa58c6fd60bebf8aa9df2a870f53061edc";
const OUTPUT_BYTE_SIZE = 76_782;

type Disposition = "reported_contest" | "certified_uncontested" | "unresolved_outside_retained_authority_scope";
type MatchMethod = "exact_normalized_official_house_name_same_district" | "derived_source_middle_initial_not_in_official_house_name_same_district" | "derived_official_middle_initial_not_in_source_name_same_district" | "derived_retained_public_alias_given_name_same_surname_and_district";
const MATCHES: Readonly<Record<string, Readonly<{ sourceCandidateName: string; method: MatchMethod }>>> = {
  "2022:07": { sourceCandidateName: "Nydia M. Velazquez", method: "exact_normalized_official_house_name_same_district" },
  "2022:08": { sourceCandidateName: "Hakeem S. Jeffries", method: "exact_normalized_official_house_name_same_district" },
  "2022:10": { sourceCandidateName: "Daniel Goldman", method: "derived_official_middle_initial_not_in_source_name_same_district" },
  "2022:12": { sourceCandidateName: "Jerrold L. Nadler", method: "derived_source_middle_initial_not_in_official_house_name_same_district" },
  "2022:13": { sourceCandidateName: "Adriano Espaillat", method: "exact_normalized_official_house_name_same_district" },
  "2022:18": { sourceCandidateName: "Pat Ryan", method: "derived_retained_public_alias_given_name_same_surname_and_district" },
  "2022:19": { sourceCandidateName: "Josh Riley", method: "exact_normalized_official_house_name_same_district" },
  "2022:20": { sourceCandidateName: "Paul D. Tonko", method: "derived_source_middle_initial_not_in_official_house_name_same_district" },
  "2024:10": { sourceCandidateName: "Daniel Goldman", method: "derived_official_middle_initial_not_in_source_name_same_district" },
  "2024:14": { sourceCandidateName: "Alexandria Ocasio-Cortez", method: "exact_normalized_official_house_name_same_district" },
  "2024:16": { sourceCandidateName: "George S. Latimer", method: "derived_source_middle_initial_not_in_official_house_name_same_district" },
  "2024:22": { sourceCandidateName: "John W. Mannion", method: "exact_normalized_official_house_name_same_district" },
};

type SourceCandidate = Readonly<{ sourceCandidateName: string; votes: number; rowIdentity: string }>;
type Observation = Readonly<{
  observationId: string; contestId: string | null; contestSha256: string | null; cycleYear: 2022 | 2024;
  electionDate: "2022-08-23" | "2024-06-25"; seatCycleId: string; districtCode: string; disposition: Disposition;
  rosterIdentity: Readonly<{ bioguideId: string; officialHouseName: string; officialHouseMemberDataSha256: typeof INPUTS.houseFile }>;
  sourceCandidateCount: number | null; sourceContestCandidateVotes: number | null; sourceCandidate: SourceCandidate | null;
  identityStatus: "proposed_identity_link" | "reported_contest_no_unique_candidate_match" | "not_applicable_no_reported_contest";
  directIdentifierBridgeAvailable: false; matchMethod: MatchMethod | null; evidenceClass: "exact_name_observation" | "derived_name_relationship" | null;
  confidence: "high" | null; relationshipDisposition: "proposed_identity_link_pending_documented_review" | "not_linked_no_unique_current_incumbent_candidate_same_district" | "not_applicable_no_reported_contest";
  resultAuthorityStatus: "official_reported_contest_candidate" | "local_canvassing_board_certified_candidate" | null;
  certificationStatus: "not_independently_retained" | "local_canvassing_board_certified" | null;
  sourceWinnerStatus: "not_established_by_composition"; identityApproved: false; historicalGeographyStatus: "separate_candidate_not_approved";
  dispositionDecisionStatus: "unresolved"; selectionStatus: "unselected_no_source_winner_inference_or_review_approval";
  evaluatorUse: "excluded_pending_identity_historical_geography_disposition_review_and_publication_approval"; scoreEligible: false;
  rationaleCodes: readonly string[]; rowSha256: string;
}>;
export type NewYorkPrimaryIdentityCandidate = Readonly<{
  schema: typeof NEW_YORK_PRIMARY_IDENTITY_V1; version: 1; generatedAt: "2026-08-06T12:00:00.000Z"; sourceCutoff: "2026-08-05";
  reviewerOnly: true; publicationEligible: false; defaultUse: "exclude_from_evaluator_until_identity_historical_geography_disposition_review_and_publication_approval";
  review: Readonly<{ status: "proposed"; reviewer: null; reviewedAt: null; resolution: null }>;
  inheritedUnresolvedGates: typeof GATES; inputs: Readonly<Record<string, unknown>>; methodology: Readonly<Record<string, unknown>>;
  summary: Readonly<{ targetSeats: 19; contestObservations: 38; reportedObservations: number; statewideReportedObservations: number; localCertifiedReportedObservations: number; certifiedUncontestedObservations: number; unresolvedObservations: number; reportedCandidateRows: number; reportedCandidateVotes: number; proposedIdentityLinks: number; exactNameObservations: number; derivedNameRelationships: number; reportedContestNoUniqueMatch: number; directIdentifierBridges: 0; automaticallyApprovedRows: 0; selectedRows: 0; scoreEligibleRows: 0 }>;
  observations: readonly Observation[]; observationSetSha256: string; decisionSupport: Readonly<Record<string, unknown>>; packageSha256: string;
}>;
export type NewYorkPrimaryIdentityInput = Readonly<{ rosterJson: string; proposalJson: string; houseXml: string; congressJson: string; dispositionsJson: string; statewideResultsJson: string; nycResultsJson: string; sourceLockJson: string }>;

const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const sha = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
const bytewise = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));
const fail = (code: string): never => { throw new Error(`New York primary identity rejected: ${code}`); };
const parse = (value: string, code: string): unknown => { try { return JSON.parse(value); } catch { return fail(code); } };
const tag = (block: string, name: string): string => block.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1] ?? "";

export function buildNewYorkPrimaryIdentityCandidate(input: NewYorkPrimaryIdentityInput): NewYorkPrimaryIdentityCandidate {
  if (sha(input.rosterJson) !== INPUTS.rosterFile || sha(input.proposalJson) !== INPUTS.proposalFile || sha(input.houseXml) !== INPUTS.houseFile || sha(input.congressJson) !== INPUTS.congressFile || sha(input.dispositionsJson) !== INPUTS.dispositionsFile || sha(input.statewideResultsJson) !== INPUTS.statewideFile || sha(input.nycResultsJson) !== INPUTS.nycFile) fail("INPUT_HASH_MISMATCH");
  const roster = validateDsaTargetIncumbentRoster(parse(input.rosterJson, "ROSTER_JSON_INVALID"));
  const proposal = validateHouseDemocraticPrimarySourceSelectionProposal(parse(input.proposalJson, "PROPOSAL_JSON_INVALID"));
  const dispositions = validateNewYorkPrimaryDispositionsV2Receipt(parse(input.dispositionsJson, "DISPOSITIONS_JSON_INVALID") as Parameters<typeof validateNewYorkPrimaryDispositionsV2Receipt>[0]);
  const statewide = validateNewYorkReportedResultsReceipt(parse(input.statewideResultsJson, "STATEWIDE_JSON_INVALID") as Parameters<typeof validateNewYorkReportedResultsReceipt>[0]);
  const nyc = validateNycCertifiedResultsReceipt(parse(input.nycResultsJson, "NYC_JSON_INVALID") as Parameters<typeof validateNycCertifiedResultsReceipt>[0]);
  if (roster.rosterSha256 !== INPUTS.rosterPackage || proposal.packageSha256 !== INPUTS.proposalPackage || dispositions.packageSha256 !== INPUTS.dispositionsPackage || dispositions.summary.dispositionSetSha256 !== INPUTS.dispositionsSet || statewide.packageSha256 !== INPUTS.statewidePackage || statewide.summary.contestSetSha256 !== INPUTS.statewideSet || nyc.packageSha256 !== INPUTS.nycPackage || nyc.summary.contestSetSha256 !== INPUTS.nycSet || dispositions.review.status !== "proposed" || statewide.review.status !== "proposed" || nyc.review.status !== "proposed" || proposal.decisions.find((row) => row.decisionId === "approve-historic-primary-candidate-identity-resolution-v1")?.resolution !== null) fail("PARENT_INVALID");
  const people = parse(input.congressJson, "CONGRESS_JSON_INVALID") as Array<{ id?: { bioguide?: string; wikipedia?: string }; name?: { official_full?: string } }>;
  if (!Array.isArray(people)) fail("IDENTITY_SOURCE_INVALID");
  const blocks = [...input.houseXml.matchAll(/<member>([\s\S]*?)<\/member>/g)].map((match) => match[1]!);
  const lock = parse(input.sourceLockJson, "SOURCE_LOCK_JSON_INVALID") as { entries?: Array<{ id: string; retainedPath?: string; retainedStatus: string; byteSize?: number; sha256: string; kind: string; parentIds?: string[] }> };
  const required = [
    ["dsa-target-incumbent-roster-20260804-v1", INPUTS.rosterFile, "data/metadata/dsa-target-incumbent-roster-20260804-v1.json", "production_projection_receipt", LOCK_PARENTS.roster],
    ["house-democratic-primary-source-selection-proposal-20260804-v1", INPUTS.proposalFile, "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "review_proposal", LOCK_PARENTS.proposal],
    ["house-xml", INPUTS.houseFile, "data/source/identity/house-member-data.xml", "source", LOCK_PARENTS.house],
    ["congress-legislators-current-20260804", INPUTS.congressFile, "data/source/identity/congress-legislators-current-20260804.json", "source", LOCK_PARENTS.congress],
    ["new-york-house-democratic-primary-dispositions-2022-2024-v2", INPUTS.dispositionsFile, "data/metadata/new-york-house-democratic-primary-dispositions-2022-2024-v2.json", "review_candidate", LOCK_PARENTS.dispositions],
    ["new-york-house-democratic-primary-reported-results-2022-2024-v1", INPUTS.statewideFile, "data/metadata/new-york-house-democratic-primary-reported-results-2022-2024-v1.json", "review_candidate", LOCK_PARENTS.statewide],
    ["new-york-city-house-democratic-primary-certified-results-2022-2024-v1", INPUTS.nycFile, "data/metadata/new-york-city-house-democratic-primary-certified-results-2022-2024-v1.json", "review_candidate", LOCK_PARENTS.nyc],
  ] as const;
  const lockEntries: NonNullable<typeof lock.entries> = lock.entries ?? fail("SOURCE_LOCK_MISMATCH");
  if (required.some(([id, file, path, kind, parents]) => { const rows = lockEntries.filter((entry) => entry.id === id); return rows.length !== 1 || rows[0]!.retainedStatus !== "retained" || rows[0]!.sha256 !== file || rows[0]!.retainedPath !== path || rows[0]!.kind !== kind || canonicalJson(rows[0]!.parentIds) !== canonicalJson(parents); })) fail("SOURCE_LOCK_MISMATCH");
  const output = lockEntries.filter((entry) => entry.id === NEW_YORK_PRIMARY_IDENTITY_V1);
  if (!OUTPUT_FILE_SHA256) { if (output.length !== 0) fail("SOURCE_LOCK_MISMATCH"); }
  else if (output.length !== 1 || output[0]!.retainedPath !== "data/metadata/new-york-current-incumbent-primary-linkage-candidate-v1.json" || output[0]!.retainedStatus !== "retained" || output[0]!.byteSize !== OUTPUT_BYTE_SIZE || output[0]!.sha256 !== OUTPUT_FILE_SHA256 || output[0]!.kind !== "review_candidate" || canonicalJson(output[0]!.parentIds) !== canonicalJson(OUTPUT_PARENTS)) fail("SOURCE_LOCK_MISMATCH");

  const observations: Observation[] = [];
  for (const [districtCode, bioguideId, officialHouseName] of TARGETS) {
    const currentSeatId = `seat_house_ny_${districtCode}_current`;
    const member = blocks.filter((block) => tag(block, "bioguideID") === bioguideId);
    const currentPeople = people.filter((person) => person.id?.bioguide === bioguideId);
    if (roster.rows.filter((row) => row.seatCycleId === currentSeatId && row.bioguideId === bioguideId).length !== 1 || member.length !== 1 || tag(member[0]!, "statedistrict") !== `NY${districtCode}` || tag(member[0]!, "official-name") !== officialHouseName || currentPeople.length !== 1 || currentPeople[0]!.name?.official_full !== officialHouseName || (bioguideId === "R000579" && currentPeople[0]!.id?.wikipedia !== "Pat Ryan (politician)")) fail("OFFICIAL_IDENTITY_CLOSURE_INVALID");
    for (const cycleYear of [2022, 2024] as const) {
      const seatCycleId = `ny:${cycleYear}:us-house:${districtCode}:democratic`;
      const dispositionRows = dispositions.rows.filter((row) => row.seatCycleId === seatCycleId);
      if (dispositionRows.length !== 1) fail("DISPOSITION_PARTITION_INVALID");
      const dispositionRow = dispositionRows[0]!;
      let contest: { contestId: string; contestSha256: string; candidates: readonly { candidateName: string; votes: number }[]; resultStatus: "official_reported_contest_candidate"; certificationStatus: "not_independently_retained" } | null = null;
      let localContest: { contestId: string; contestSha256: string; ballotCandidates: readonly { optionName: string; votes: number }[]; ballotCandidateVotes: number; resultStatus: "local_canvassing_board_certified_candidate" } | null = null;
      if (dispositionRow.disposition === "reported_contest" && dispositionRow.localAuthority === null) {
        const rows = statewide.contests.filter((row) => row.contestId === dispositionRow.reportedContestId); if (rows.length !== 1) fail("STATEWIDE_CONTEST_LINEAGE_INVALID"); contest = rows[0]!;
      } else if (dispositionRow.disposition === "reported_contest") {
        const rows = nyc.contests.filter((row) => row.contestId === dispositionRow.localAuthority?.localCertifiedContestId); if (rows.length !== 1 || rows[0]!.contestSha256 !== dispositionRow.localAuthority?.contestSha256) fail("LOCAL_CONTEST_LINEAGE_INVALID"); localContest = rows[0]!;
      }
      const candidates = contest?.candidates.map((row) => ({ sourceCandidateName: row.candidateName, votes: row.votes })) ?? localContest?.ballotCandidates.map((row) => ({ sourceCandidateName: row.optionName, votes: row.votes })) ?? null;
      const expected = MATCHES[`${cycleYear}:${districtCode}`];
      const matched = expected === undefined || candidates === null ? undefined : candidates.find((row) => row.sourceCandidateName === expected.sourceCandidateName);
      if (expected !== undefined && matched === undefined) fail("SOURCE_CANDIDATE_IDENTITY_INVALID");
      const sourceCandidate = matched === undefined ? null : { ...matched, rowIdentity: digest("dsa-seats:ny-primary-identity-source-candidate:v1\0", { contestId: contest?.contestId ?? localContest?.contestId, contestSha256: contest?.contestSha256 ?? localContest?.contestSha256, ...matched }) };
      const reported = dispositionRow.disposition === "reported_contest";
      const exact = expected?.method === "exact_normalized_official_house_name_same_district";
      const unsigned = {
        observationId: `ny:identity:${cycleYear}:${districtCode}`, contestId: contest?.contestId ?? localContest?.contestId ?? null,
        contestSha256: contest?.contestSha256 ?? localContest?.contestSha256 ?? null, cycleYear,
        electionDate: cycleYear === 2022 ? "2022-08-23" as const : "2024-06-25" as const, seatCycleId, districtCode,
        disposition: dispositionRow.disposition, rosterIdentity: { bioguideId, officialHouseName, officialHouseMemberDataSha256: INPUTS.houseFile },
        sourceCandidateCount: candidates?.length ?? null,
        sourceContestCandidateVotes: contest === null ? localContest?.ballotCandidateVotes ?? null : contest.candidates.reduce((sum, row) => sum + row.votes, 0),
        sourceCandidate,
        identityStatus: !reported ? "not_applicable_no_reported_contest" as const : expected === undefined ? "reported_contest_no_unique_candidate_match" as const : "proposed_identity_link" as const,
        directIdentifierBridgeAvailable: false as const, matchMethod: expected?.method ?? null,
        evidenceClass: expected === undefined ? null : exact ? "exact_name_observation" as const : "derived_name_relationship" as const,
        confidence: expected === undefined ? null : "high" as const,
        relationshipDisposition: !reported ? "not_applicable_no_reported_contest" as const : expected === undefined ? "not_linked_no_unique_current_incumbent_candidate_same_district" as const : "proposed_identity_link_pending_documented_review" as const,
        resultAuthorityStatus: contest?.resultStatus ?? localContest?.resultStatus ?? null,
        certificationStatus: contest?.certificationStatus ?? (localContest ? "local_canvassing_board_certified" as const : null),
        sourceWinnerStatus: "not_established_by_composition" as const, identityApproved: false as const,
        historicalGeographyStatus: "separate_candidate_not_approved" as const, dispositionDecisionStatus: "unresolved" as const,
        selectionStatus: "unselected_no_source_winner_inference_or_review_approval" as const,
        evaluatorUse: "excluded_pending_identity_historical_geography_disposition_review_and_publication_approval" as const, scoreEligible: false as const,
        rationaleCodes: !reported ? [dispositionRow.disposition, "no_reported_candidate_evidence_composed"] : expected === undefined ? ["reported_contest_no_unique_current_incumbent_candidate_match", "predecessor_candidate_not_cross_linked", "source_winner_not_established_by_composition"] : [expected.method, "same_district_and_cycle", "finite_audited_name_relationship", "source_candidate_has_no_direct_person_identifier", "source_winner_not_established_by_composition"],
      };
      observations.push({ ...unsigned, rowSha256: digest("dsa-seats:ny-primary-identity-row:v1\0", unsigned) });
    }
  }
  observations.sort((left, right) => bytewise(left.observationId, right.observationId));
  const observationSetSha256 = digest("dsa-seats:ny-primary-identity-row-set:v1\0", observations);
  const unsigned = {
    schema: NEW_YORK_PRIMARY_IDENTITY_V1, version: 1 as const, generatedAt: "2026-08-06T12:00:00.000Z" as const, sourceCutoff: "2026-08-05" as const,
    reviewerOnly: true as const, publicationEligible: false as const, defaultUse: "exclude_from_evaluator_until_identity_historical_geography_disposition_review_and_publication_approval" as const,
    review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null }, inheritedUnresolvedGates: GATES,
    inputs: { roster: { sourceLockId: required[0][0], fileSha256: INPUTS.rosterFile, rosterSha256: INPUTS.rosterPackage }, proposal: { sourceLockId: required[1][0], fileSha256: INPUTS.proposalFile, packageSha256: INPUTS.proposalPackage }, houseClerk: { sourceLockId: required[2][0], fileSha256: INPUTS.houseFile }, congressLegislators: { sourceLockId: required[3][0], fileSha256: INPUTS.congressFile }, dispositions: { sourceLockId: required[4][0], fileSha256: INPUTS.dispositionsFile, packageSha256: INPUTS.dispositionsPackage, dispositionSetSha256: INPUTS.dispositionsSet }, statewideResults: { sourceLockId: required[5][0], fileSha256: INPUTS.statewideFile, packageSha256: INPUTS.statewidePackage, contestSetSha256: INPUTS.statewideSet }, nycResults: { sourceLockId: required[6][0], fileSha256: INPUTS.nycFile, packageSha256: INPUTS.nycPackage, contestSetSha256: INPUTS.nycSet } },
    methodology: { scope: "nineteen_current_new_york_democratic_target_seats_times_two_retained_disposition_cycles", matchTreatment: "finite_audited_exact_middle_initial_and_one_retained_public_alias_relationship_no_fuzzy_matching", resultComposition: "v2_disposition_selects_statewide_or_explicit_local_certified_contest_parent", sourceWinnerTreatment: "not_established_by_composition", noMatchTreatment: "retain_reported_contest_without_current_incumbent_identity_link", nonreportedTreatment: "retain_disposition_with_null_contest_candidate_and_vote_values", automaticDecisionClosure: false, evaluatorNumericValues: 0 },
    summary: { targetSeats: 19 as const, contestObservations: 38 as const, reportedObservations: observations.filter((row) => row.disposition === "reported_contest").length, statewideReportedObservations: observations.filter((row) => row.resultAuthorityStatus === "official_reported_contest_candidate").length, localCertifiedReportedObservations: observations.filter((row) => row.resultAuthorityStatus === "local_canvassing_board_certified_candidate").length, certifiedUncontestedObservations: observations.filter((row) => row.disposition === "certified_uncontested").length, unresolvedObservations: observations.filter((row) => row.disposition === "unresolved_outside_retained_authority_scope").length, reportedCandidateRows: observations.reduce((sum, row) => sum + (row.sourceCandidateCount ?? 0), 0), reportedCandidateVotes: observations.reduce((sum, row) => sum + (row.sourceContestCandidateVotes ?? 0), 0), proposedIdentityLinks: observations.filter((row) => row.identityStatus === "proposed_identity_link").length, exactNameObservations: observations.filter((row) => row.evidenceClass === "exact_name_observation").length, derivedNameRelationships: observations.filter((row) => row.evidenceClass === "derived_name_relationship").length, reportedContestNoUniqueMatch: observations.filter((row) => row.identityStatus === "reported_contest_no_unique_candidate_match").length, directIdentifierBridges: 0 as const, automaticallyApprovedRows: 0 as const, selectedRows: 0 as const, scoreEligibleRows: 0 as const },
    observations, observationSetSha256,
    decisionSupport: { decisionId: "approve-historic-primary-candidate-identity-resolution-v1", status: "proposed", recommendedResolution: "accept_six_exact_and_six_finite_derived_links_and_retain_four_predecessor_rows_as_explicit_no_matches", defaultAssumption: "exclude_all_thirty_eight_rows_from_evaluator_until_identity_and_geography_review", affectedObservationIds: observations.map((row) => row.observationId), proposedIdentityObservationIds: observations.filter((row) => row.identityStatus === "proposed_identity_link").map((row) => row.observationId), noMatchObservationIds: observations.filter((row) => row.identityStatus === "reported_contest_no_unique_candidate_match").map((row) => row.observationId), reviewerResolution: null, reviewer: null, reviewedAt: null },
  };
  return { ...unsigned, packageSha256: digest("dsa-seats:ny-primary-identity-candidate:v1\0", unsigned) };
}

export function validateNewYorkPrimaryIdentityCandidate(value: unknown): NewYorkPrimaryIdentityCandidate {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail("PACKAGE_SHAPE_INVALID");
  const candidate = value as NewYorkPrimaryIdentityCandidate;
  if (candidate.schema !== NEW_YORK_PRIMARY_IDENTITY_V1 || candidate.version !== 1 || candidate.generatedAt !== "2026-08-06T12:00:00.000Z" || candidate.sourceCutoff !== "2026-08-05" || !candidate.reviewerOnly || candidate.publicationEligible || candidate.review.status !== "proposed" || candidate.review.reviewer !== null || candidate.review.reviewedAt !== null || candidate.review.resolution !== null || canonicalJson(candidate.inheritedUnresolvedGates) !== canonicalJson(GATES) || candidate.observations.some((row) => row.identityApproved || row.scoreEligible || row.sourceWinnerStatus !== "not_established_by_composition" || row.selectionStatus !== "unselected_no_source_winner_inference_or_review_approval")) fail("LIFECYCLE_INVALID");
  const summary = candidate.summary;
  if (summary.targetSeats !== 19 || summary.contestObservations !== 38 || summary.reportedObservations !== 16 || summary.statewideReportedObservations !== 9 || summary.localCertifiedReportedObservations !== 7 || summary.certifiedUncontestedObservations !== 7 || summary.unresolvedObservations !== 15 || summary.reportedCandidateRows !== 55 || summary.reportedCandidateVotes !== 652367 || summary.proposedIdentityLinks !== 12 || summary.exactNameObservations !== 6 || summary.derivedNameRelationships !== 6 || summary.reportedContestNoUniqueMatch !== 4 || summary.directIdentifierBridges !== 0 || summary.automaticallyApprovedRows !== 0 || summary.selectedRows !== 0 || summary.scoreEligibleRows !== 0) fail("SUMMARY_INVALID");
  if (candidate.observations.length !== 38 || candidate.observations.some((row) => { const unsigned = structuredClone(row) as { rowSha256?: string }; delete unsigned.rowSha256; return row.rowSha256 !== digest("dsa-seats:ny-primary-identity-row:v1\0", unsigned) || (row.disposition !== "reported_contest" && (row.contestId !== null || row.contestSha256 !== null || row.sourceCandidateCount !== null || row.sourceContestCandidateVotes !== null || row.sourceCandidate !== null)); }) || candidate.observationSetSha256 !== digest("dsa-seats:ny-primary-identity-row-set:v1\0", candidate.observations)) fail("ROW_HASH_INVALID");
  const { packageSha256, ...unsigned } = candidate;
  if (packageSha256 !== digest("dsa-seats:ny-primary-identity-candidate:v1\0", unsigned)) fail("PACKAGE_HASH_INVALID");
  if (NEW_YORK_PRIMARY_IDENTITY_OBSERVATION_SET_SHA256 && candidate.observationSetSha256 !== NEW_YORK_PRIMARY_IDENTITY_OBSERVATION_SET_SHA256) fail("OBSERVATION_SET_INVALID");
  if (NEW_YORK_PRIMARY_IDENTITY_PACKAGE_SHA256 && candidate.packageSha256 !== NEW_YORK_PRIMARY_IDENTITY_PACKAGE_SHA256) fail("PACKAGE_IDENTITY_INVALID");
  return candidate;
}
