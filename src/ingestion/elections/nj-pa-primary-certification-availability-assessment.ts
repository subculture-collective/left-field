import { createHash } from "node:crypto";
import { z } from "zod";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import { validateNewJerseyPrimaryResultsReceipt } from "./new-jersey-house-democratic-primary-results-receipt";
import { validatePennsylvaniaPrimaryResultsReceipt } from "./pennsylvania-house-democratic-primary-results-receipt";

const SHA = z.string().regex(/^[a-f0-9]{64}$/);
const INPUTS = {
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1", proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  njReceiptFile: "f605cbdcb6c20694df4daf3dd9bd9be21489518d3aa3cb48bd8a8f5037ba060e", njReceiptPackage: "946205e381d17d6351f2f86867da9fd54280b5d8680c8a34ac7bde7914293157", njContestSet: "5f06d436f125403cf12a7aa0531a9d9e4348f9b4f7c8925ab86714072ec72946",
  paReceiptFile: "5815a8ed7e5cadb59c63f27598e0afbc9ec3fa469ecf3837ae0bf3b533920644", paReceiptPackage: "2cfc554133dcdcde38e345c2af67636f7cb5b1ec1c5290f5db27dab11be2f6eb", paContestSet: "82e392e32a1520bb58f74603f64ccb24af1edf89914554c4559a58f56dcc96b1",
  njStatuteFile: "1750d1b98e082d43f24f7c5378179d03e4c80d60fb3232f3be5042af836a6bae",
  paBoundaryFile: "33fb658f191c7fa728a248427bc08b03cf02bfdd27c70dfc32966b8d1505f6cf",
  pa2024CertificationFile: "faac7574af526b4bd82fd7bea2be33053dc26808e92289e8e272cb180826dc5b",
  pa2026CertificationFile: "cc4b87be3cf4c86d40ad0a1f219340aba98a838b7127495397bd45a7e544c3e8",
} as const;
const EXPECTED_PACKAGE = "7cf437c67e4b457e110ae03cc0ef0f88afc004fb0c19a279d4646fa8a163fa4a";
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");
const fileDigest = (value: string): string => createHash("sha256").update(Buffer.from(value)).digest("hex");
const bytewise = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));

const row = z.strictObject({
  stateCycleId: z.enum(["NJ:2022", "NJ:2024", "NJ:2026", "PA:2022", "PA:2024", "PA:2026"]),
  stateCode: z.enum(["NJ", "PA"]), cycleYear: z.union([z.literal(2022), z.literal(2024), z.literal(2026)]),
  resultReceiptSourceLockId: z.enum(["new-jersey-house-democratic-primary-results-2022-2026-v1", "pennsylvania-house-democratic-primary-results-2022-2024-v1"]).nullable(),
  resultArtifactStatus: z.enum(["state_division_official_result_candidate_retained", "department_precinct_return_extract_candidate_retained", "official_result_extract_not_retained"]),
  certificationContextStatus: z.enum(["post_canvass_secretary_certificate_not_retained", "cycle_certification_authority_not_retained", "statewide_election_certification_statement_retained_exact_extract_unbound", "statewide_election_certification_statement_retained_result_extract_missing"]),
  certificationContextSourceLockIds: z.array(z.enum(["nj-primary-post-canvass-certification-statute-20260805", "pa-election-result-authority-boundary-20260805", "pa-2024-primary-certification-announcement", "pa-2026-primary-certification-announcement"])).min(1).max(2),
  evidenceClass: z.literal("direct_official_authority_observation"), confidence: z.literal("high"),
  exactResultBytesRetained: z.boolean(), cycleCertificationContextRetained: z.boolean(), exactResultCertificationReconciled: z.literal(false),
  unresolvedNoRowDistrictCodes: z.array(z.enum(["13", "14", "15"])).max(3),
  automaticApproval: z.literal(false), evaluatorUse: z.literal("excluded_pending_complete_state_result_and_certification_closure"), scoreEligible: z.literal(false), rationaleCodes: z.array(z.string()).min(2), rowSha256: SHA,
});

export const njPaPrimaryCertificationAvailabilityAssessmentSchema = z.strictObject({
  schema: z.literal("nj-pa-primary-certification-availability-assessment-v1"), version: z.literal(1), generatedAt: z.literal("2026-08-05T15:54:29.000Z"),
  sourceCutoff: z.literal("2026-08-05"), parentSourceCutoff: z.literal("2026-08-04"), parentSuperseded: z.literal(false), reviewerOnly: z.literal(true), publicationEligible: z.literal(false),
  defaultUse: z.literal("exclude_from_evaluator_and_publication_until_bound_parent_decision_complete_114_state_cycle_authority_closure_and_all_other_gates_are_approved"),
  review: z.strictObject({ status: z.literal("proposed"), reviewer: z.null(), reviewedAt: z.null(), resolution: z.null() }),
  inputs: z.strictObject({
    sourceSelectionProposal: z.strictObject({ sourceLockId: z.literal("house-democratic-primary-source-selection-proposal-20260804-v1"), fileSha256: z.literal(INPUTS.proposalFile), packageSha256: z.literal(INPUTS.proposalPackage), informedDecisionId: z.literal("collect-official-state-primary-results-and-certification-v1"), decisionUnresolved: z.literal(true) }),
    newJerseyReceipt: z.strictObject({ sourceLockId: z.literal("new-jersey-house-democratic-primary-results-2022-2026-v1"), fileSha256: z.literal(INPUTS.njReceiptFile), packageSha256: z.literal(INPUTS.njReceiptPackage), contestSetSha256: z.literal(INPUTS.njContestSet) }),
    pennsylvaniaReceipt: z.strictObject({ sourceLockId: z.literal("pennsylvania-house-democratic-primary-results-2022-2024-v1"), fileSha256: z.literal(INPUTS.paReceiptFile), packageSha256: z.literal(INPUTS.paReceiptPackage), contestSetSha256: z.literal(INPUTS.paContestSet) }),
    authorities: z.tuple([
      z.strictObject({ sourceLockId: z.literal("nj-primary-post-canvass-certification-statute-20260805"), fileSha256: z.literal(INPUTS.njStatuteFile), authorityRole: z.literal("nj_distinct_post_canvass_secretary_certificate_requirement") }),
      z.strictObject({ sourceLockId: z.literal("pa-2024-primary-certification-announcement"), fileSha256: z.literal(INPUTS.pa2024CertificationFile), authorityRole: z.literal("pa_2024_statewide_election_certification_context") }),
      z.strictObject({ sourceLockId: z.literal("pa-2026-primary-certification-announcement"), fileSha256: z.literal(INPUTS.pa2026CertificationFile), authorityRole: z.literal("pa_2026_statewide_election_certification_context") }),
      z.strictObject({ sourceLockId: z.literal("pa-election-result-authority-boundary-20260805"), fileSha256: z.literal(INPUTS.paBoundaryFile), authorityRole: z.literal("pa_countywide_summary_and_precinct_authority_boundary") }),
    ]),
  }),
  methodology: z.strictObject({
    scope: z.literal("six_nj_pa_state_cycles_with_result_or_certification_authority_observations"), availabilityIsNotCertification: z.literal(true), absenceOfRetainedArtifactIsNotClaimOfNonexistence: z.literal(true),
    statewideCertificationDoesNotBindExactPrecinctExtract: z.literal(true), officialResultListDoesNotReplaceNjPostCanvassCertificate: z.literal(true),
    noCycleOrStateClosureDecisionMade: z.literal(true), full114CycleClosureStillRequired: z.literal(true), allOtherPrimaryGatesRemainRequired: z.literal(true), promotionNotAssessed: z.literal(true), automaticApprovals: z.literal(0), evaluatorNumericValues: z.literal(0),
  }),
  privacy: z.strictObject({ candidateNamesExcluded: z.literal(true), candidateAddressesContactsAndVotesExcluded: z.literal(true), rawSourceTextExcluded: z.literal(true) }),
  summary: z.strictObject({ stateCyclesAssessed: z.literal(6), exactResultArtifactsRetained: z.literal(5), officialNjResultCandidates: z.literal(3), paDepartmentExtractCandidates: z.literal(2), statewideCertificationStatementsRetained: z.literal(2), exactResultCertificationReconciliations: z.literal(0), missingResultExtracts: z.literal(1), automaticApprovals: z.literal(0), scoreEligibleRows: z.literal(0) }),
  rows: z.array(row).length(6), rowSetSha256: SHA,
  decisionSupport: z.strictObject({ informsDecisionId: z.literal("collect-official-state-primary-results-and-certification-v1"), analysisConclusion: z.literal("nj_official_lists_and_pa_statewide_certification_context_improve_authority_visibility_but_zero_exact_result_artifacts_are_certification_reconciled"), lifecycle: z.literal("evidence_for_bound_existing_decision_not_an_independent_decision") }),
  packageSha256: SHA,
});
export type NjPaPrimaryCertificationAvailabilityAssessment = z.infer<typeof njPaPrimaryCertificationAvailabilityAssessmentSchema>;
type Row = z.infer<typeof row>;

function expectedRows(): Omit<Row, "rowSha256">[] {
  const nj = ([2022, 2024, 2026] as const).map((cycleYear) => ({
    stateCycleId: `NJ:${cycleYear}` as const, stateCode: "NJ" as const, cycleYear, resultReceiptSourceLockId: "new-jersey-house-democratic-primary-results-2022-2026-v1" as const,
    resultArtifactStatus: "state_division_official_result_candidate_retained" as const, certificationContextStatus: "post_canvass_secretary_certificate_not_retained" as const,
    certificationContextSourceLockIds: ["nj-primary-post-canvass-certification-statute-20260805" as const], evidenceClass: "direct_official_authority_observation" as const, confidence: "high" as const,
    exactResultBytesRetained: true, cycleCertificationContextRetained: false, exactResultCertificationReconciled: false as const, unresolvedNoRowDistrictCodes: [], automaticApproval: false as const,
    evaluatorUse: "excluded_pending_complete_state_result_and_certification_closure" as const, scoreEligible: false as const,
    rationaleCodes: ["division_official_result_list_retained", "nj_law_requires_distinct_secretary_post_canvass_certificate", "post_canvass_certificate_not_located_or_retained"],
  }));
  const pa2022 = { stateCycleId: "PA:2022" as const, stateCode: "PA" as const, cycleYear: 2022 as const, resultReceiptSourceLockId: "pennsylvania-house-democratic-primary-results-2022-2024-v1" as const, resultArtifactStatus: "department_precinct_return_extract_candidate_retained" as const, certificationContextStatus: "cycle_certification_authority_not_retained" as const, certificationContextSourceLockIds: ["pa-election-result-authority-boundary-20260805" as const], evidenceClass: "direct_official_authority_observation" as const, confidence: "high" as const, exactResultBytesRetained: true, cycleCertificationContextRetained: false, exactResultCertificationReconciled: false as const, unresolvedNoRowDistrictCodes: ["13", "14", "15"] as ("13" | "14" | "15")[], automaticApproval: false as const, evaluatorUse: "excluded_pending_complete_state_result_and_certification_closure" as const, scoreEligible: false as const, rationaleCodes: ["department_extract_retained", "extract_dated_election_day_not_final_certification", "official_precinct_returns_maintained_by_county_boards", "three_district_absences_remain_unresolved_not_zero"] };
  const pa2024 = { ...pa2022, stateCycleId: "PA:2024" as const, cycleYear: 2024 as const, certificationContextStatus: "statewide_election_certification_statement_retained_exact_extract_unbound" as const, certificationContextSourceLockIds: ["pa-2024-primary-certification-announcement" as const, "pa-election-result-authority-boundary-20260805" as const], cycleCertificationContextRetained: true, unresolvedNoRowDistrictCodes: [], rationaleCodes: ["department_extract_retained_fifty_days_after_statewide_certification", "statewide_certification_statement_retained", "announcement_does_not_identify_or_hash_exact_extract", "official_precinct_returns_maintained_by_county_boards"] };
  const pa2026 = { ...pa2022, stateCycleId: "PA:2026" as const, cycleYear: 2026 as const, resultReceiptSourceLockId: null, resultArtifactStatus: "official_result_extract_not_retained" as const, certificationContextStatus: "statewide_election_certification_statement_retained_result_extract_missing" as const, certificationContextSourceLockIds: ["pa-2026-primary-certification-announcement" as const, "pa-election-result-authority-boundary-20260805" as const], exactResultBytesRetained: false, cycleCertificationContextRetained: true, unresolvedNoRowDistrictCodes: [], rationaleCodes: ["statewide_certification_statement_retained", "certification_statement_does_not_substitute_for_result_extract", "no_resolvable_result_extract_bytes_observed_at_cutoff", "absence_of_retained_extract_is_not_zero_or_no_contest"] };
  return [...nj, pa2022, pa2024, pa2026].sort((left, right) => bytewise(left.stateCycleId, right.stateCycleId));
}

export function assertNjPaPrimaryCertificationRows(value: unknown): void {
  const rows = z.array(row).length(6).parse(value);
  const expected = expectedRows();
  if (rows.some((actual, index) => { const { rowSha256, ...unsigned } = actual; return rowSha256 !== digest("dsa-seats:nj-pa-primary-certification-availability-row:v1\0", unsigned) || canonicalJson(unsigned) !== canonicalJson(expected[index]); })) throw new Error("PRIMARY_CERTIFICATION_AVAILABILITY_ROW_INVALID");
}

export function buildNjPaPrimaryCertificationAvailabilityAssessment(input: Readonly<{ proposal: unknown; proposalFileSha256: string; newJerseyReceipt: unknown; newJerseyReceiptFileSha256: string; pennsylvaniaReceipt: unknown; pennsylvaniaReceiptFileSha256: string; njStatuteHtml: string; njStatuteFileSha256: string; paBoundaryHtml: string; paBoundaryFileSha256: string; pa2024CertificationHtml: string; pa2024CertificationFileSha256: string; pa2026CertificationHtml: string; pa2026CertificationFileSha256: string; sourceLock: unknown }>): NjPaPrimaryCertificationAvailabilityAssessment {
  const files = [input.proposalFileSha256, input.newJerseyReceiptFileSha256, input.pennsylvaniaReceiptFileSha256, input.njStatuteFileSha256, input.paBoundaryFileSha256, input.pa2024CertificationFileSha256, input.pa2026CertificationFileSha256];
  const expectedFiles = [INPUTS.proposalFile, INPUTS.njReceiptFile, INPUTS.paReceiptFile, INPUTS.njStatuteFile, INPUTS.paBoundaryFile, INPUTS.pa2024CertificationFile, INPUTS.pa2026CertificationFile];
  if (files.some((value, index) => value !== expectedFiles[index]) || fileDigest(input.njStatuteHtml) !== INPUTS.njStatuteFile || fileDigest(input.paBoundaryHtml) !== INPUTS.paBoundaryFile || fileDigest(input.pa2024CertificationHtml) !== INPUTS.pa2024CertificationFile || fileDigest(input.pa2026CertificationHtml) !== INPUTS.pa2026CertificationFile) throw new Error("PRIMARY_CERTIFICATION_AVAILABILITY_INPUT_FILE_HASH_MISMATCH");
  const proposal = validateHouseDemocraticPrimarySourceSelectionProposal(input.proposal);
  const newJersey = validateNewJerseyPrimaryResultsReceipt(input.newJerseyReceipt as Parameters<typeof validateNewJerseyPrimaryResultsReceipt>[0]);
  const pennsylvania = validatePennsylvaniaPrimaryResultsReceipt(input.pennsylvaniaReceipt as Parameters<typeof validatePennsylvaniaPrimaryResultsReceipt>[0]);
  const decision = proposal.decisions.find((candidate) => candidate.decisionId === "collect-official-state-primary-results-and-certification-v1");
  if (proposal.packageSha256 !== INPUTS.proposalPackage || !decision || decision.resolution !== null || newJersey.packageSha256 !== INPUTS.njReceiptPackage || newJersey.summary.contestSetSha256 !== INPUTS.njContestSet || pennsylvania.packageSha256 !== INPUTS.paReceiptPackage || pennsylvania.summary.contestSetSha256 !== INPUTS.paContestSet) throw new Error("PRIMARY_CERTIFICATION_AVAILABILITY_PARENT_INVALID");
  const semantics = [
    [input.njStatuteHtml, "NJSA 19:23-57 Canvass of votes by secretary of state; certificates of election issued", "shall issue a certificate of election to each person shown by such canvass"],
    [input.paBoundaryHtml, "Returns remain unofficial until certified", "Official precinct election returns are maintained by the county boards of elections"],
    [input.pa2024CertificationHtml, "certified the results of Pennsylvania’s 2024 primary election", "All results are official"],
    [input.pa2026CertificationHtml, "certified the results of Pennsylvania’s 2026 primary election", "signed the official certification document"],
  ];
  if (semantics.some(([text, first, second]) => !text.includes(first) || !text.includes(second))) throw new Error("PRIMARY_CERTIFICATION_AVAILABILITY_AUTHORITY_SEMANTICS_INVALID");
  const lock = z.object({ entries: z.array(z.object({ id: z.string(), retainedPath: z.string().nullable().optional(), retainedStatus: z.string(), sha256: SHA, kind: z.string() })) }).parse(input.sourceLock);
  const required = [
    ["house-democratic-primary-source-selection-proposal-20260804-v1", INPUTS.proposalFile, "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "review_proposal"],
    ["new-jersey-house-democratic-primary-results-2022-2026-v1", INPUTS.njReceiptFile, "data/metadata/new-jersey-house-democratic-primary-results-2022-2026-v1.json", "review_candidate"],
    ["pennsylvania-house-democratic-primary-results-2022-2024-v1", INPUTS.paReceiptFile, "data/metadata/pennsylvania-house-democratic-primary-results-2022-2024-v1.json", "review_candidate"],
    ["nj-primary-post-canvass-certification-statute-20260805", INPUTS.njStatuteFile, "data/source/elections/primary-results/certification/new-jersey/election-statutes-title-19-chapters-20-29.html", "source"],
    ["pa-election-result-authority-boundary-20260805", INPUTS.paBoundaryFile, "data/source/elections/primary-results/certification/pennsylvania/election-data-authority-boundary.html", "source"],
    ["pa-2024-primary-certification-announcement", INPUTS.pa2024CertificationFile, "data/source/elections/primary-results/certification/pennsylvania/2024-primary-certification.html", "source"],
    ["pa-2026-primary-certification-announcement", INPUTS.pa2026CertificationFile, "data/source/elections/primary-results/certification/pennsylvania/2026-primary-certification.html", "source"],
  ] as const;
  if (required.some(([id, sha, path, kind]) => { const matches = lock.entries.filter((entry) => entry.id === id); return matches.length !== 1 || matches[0]!.retainedStatus !== "retained" || matches[0]!.sha256 !== sha || matches[0]!.retainedPath !== path || matches[0]!.kind !== kind; })) throw new Error("PRIMARY_CERTIFICATION_AVAILABILITY_SOURCE_LOCK_MISMATCH");
  const rows = expectedRows().map((unsigned) => row.parse({ ...unsigned, rowSha256: digest("dsa-seats:nj-pa-primary-certification-availability-row:v1\0", unsigned) }));
  const unsigned = {
    schema: "nj-pa-primary-certification-availability-assessment-v1" as const, version: 1 as const, generatedAt: "2026-08-05T15:54:29.000Z" as const, sourceCutoff: "2026-08-05" as const, parentSourceCutoff: "2026-08-04" as const, parentSuperseded: false as const, reviewerOnly: true as const, publicationEligible: false as const,
    defaultUse: "exclude_from_evaluator_and_publication_until_bound_parent_decision_complete_114_state_cycle_authority_closure_and_all_other_gates_are_approved" as const, review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null },
    inputs: { sourceSelectionProposal: { sourceLockId: "house-democratic-primary-source-selection-proposal-20260804-v1" as const, fileSha256: INPUTS.proposalFile, packageSha256: INPUTS.proposalPackage, informedDecisionId: "collect-official-state-primary-results-and-certification-v1" as const, decisionUnresolved: true as const }, newJerseyReceipt: { sourceLockId: "new-jersey-house-democratic-primary-results-2022-2026-v1" as const, fileSha256: INPUTS.njReceiptFile, packageSha256: INPUTS.njReceiptPackage, contestSetSha256: INPUTS.njContestSet }, pennsylvaniaReceipt: { sourceLockId: "pennsylvania-house-democratic-primary-results-2022-2024-v1" as const, fileSha256: INPUTS.paReceiptFile, packageSha256: INPUTS.paReceiptPackage, contestSetSha256: INPUTS.paContestSet }, authorities: [
      { sourceLockId: "nj-primary-post-canvass-certification-statute-20260805" as const, fileSha256: INPUTS.njStatuteFile, authorityRole: "nj_distinct_post_canvass_secretary_certificate_requirement" as const },
      { sourceLockId: "pa-2024-primary-certification-announcement" as const, fileSha256: INPUTS.pa2024CertificationFile, authorityRole: "pa_2024_statewide_election_certification_context" as const },
      { sourceLockId: "pa-2026-primary-certification-announcement" as const, fileSha256: INPUTS.pa2026CertificationFile, authorityRole: "pa_2026_statewide_election_certification_context" as const },
      { sourceLockId: "pa-election-result-authority-boundary-20260805" as const, fileSha256: INPUTS.paBoundaryFile, authorityRole: "pa_countywide_summary_and_precinct_authority_boundary" as const },
    ] as const },
    methodology: { scope: "six_nj_pa_state_cycles_with_result_or_certification_authority_observations" as const, availabilityIsNotCertification: true as const, absenceOfRetainedArtifactIsNotClaimOfNonexistence: true as const, statewideCertificationDoesNotBindExactPrecinctExtract: true as const, officialResultListDoesNotReplaceNjPostCanvassCertificate: true as const, noCycleOrStateClosureDecisionMade: true as const, full114CycleClosureStillRequired: true as const, allOtherPrimaryGatesRemainRequired: true as const, promotionNotAssessed: true as const, automaticApprovals: 0 as const, evaluatorNumericValues: 0 as const },
    privacy: { candidateNamesExcluded: true as const, candidateAddressesContactsAndVotesExcluded: true as const, rawSourceTextExcluded: true as const },
    summary: { stateCyclesAssessed: 6 as const, exactResultArtifactsRetained: 5 as const, officialNjResultCandidates: 3 as const, paDepartmentExtractCandidates: 2 as const, statewideCertificationStatementsRetained: 2 as const, exactResultCertificationReconciliations: 0 as const, missingResultExtracts: 1 as const, automaticApprovals: 0 as const, scoreEligibleRows: 0 as const },
    rows, rowSetSha256: digest("dsa-seats:nj-pa-primary-certification-availability-row-set:v1\0", rows), decisionSupport: { informsDecisionId: "collect-official-state-primary-results-and-certification-v1" as const, analysisConclusion: "nj_official_lists_and_pa_statewide_certification_context_improve_authority_visibility_but_zero_exact_result_artifacts_are_certification_reconciled" as const, lifecycle: "evidence_for_bound_existing_decision_not_an_independent_decision" as const },
  };
  return validateNjPaPrimaryCertificationAvailabilityAssessment({ ...unsigned, packageSha256: digest("dsa-seats:nj-pa-primary-certification-availability-assessment:v1\0", unsigned) });
}

export function validateNjPaPrimaryCertificationAvailabilityAssessment(value: unknown): NjPaPrimaryCertificationAvailabilityAssessment {
  const parsed = njPaPrimaryCertificationAvailabilityAssessmentSchema.parse(value); const { packageSha256, ...unsigned } = parsed;
  assertNjPaPrimaryCertificationRows(parsed.rows);
  if (parsed.rowSetSha256 !== digest("dsa-seats:nj-pa-primary-certification-availability-row-set:v1\0", parsed.rows)) throw new Error("PRIMARY_CERTIFICATION_AVAILABILITY_ROW_SET_INVALID");
  if ((EXPECTED_PACKAGE && packageSha256 !== EXPECTED_PACKAGE) || packageSha256 !== digest("dsa-seats:nj-pa-primary-certification-availability-assessment:v1\0", unsigned)) throw new Error("PRIMARY_CERTIFICATION_AVAILABILITY_PACKAGE_HASH_MISMATCH");
  return parsed;
}
