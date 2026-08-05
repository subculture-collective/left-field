import { createHash } from "node:crypto";
import { z } from "zod";
import { canonicalJson } from "./aipac-proposed-packages";

const SHA = z.string().regex(/^[a-f0-9]{64}$/);
const PROPOSAL_FILE_SHA256 = "6e47107b725e2f92aba68af7f90a4910289d7e2b6356941c242245c5fe5cd8f6";
const AUTHORITY_FILE_SHA256 = "a86ffd899a159db48fe69d61a18f800bc153c1468322ec317e35de901747d485";
const PARTY_ALIAS_AUTHORITY_SHA256 = "6d6ff77809297594b659addf2209ccd1112ae9336702680e0a802bca27f1c799";
const EXPECTED_SEATS = ["seat_house_ca_31_current", "seat_house_ma_06_current", "seat_house_md_04_current", "seat_house_mn_03_current", "seat_house_nh_01_current", "seat_house_ny_04_current"] as const;

const authorityCycle = z.strictObject({
  cycleYear: z.union([z.literal(2022), z.literal(2024), z.literal(2026)]),
  status: z.enum(["proposed_house_relationship", "office_changed_to_senate"]),
  committeeIds: z.array(z.string().regex(/^C\d{8}$/)).max(1),
  evidenceRule: z.enum(["exact_cn_ccl_principal_match", "corrected_cn_ccl_principal_match", "exact_cn_ccl_principal_match_party_alias", "ccl_missing_direct_form_evidence_override", "later_form2_and_form1_different_office"]),
});

const authorityCase = z.strictObject({
  sourceDecisionId: z.string().min(1),
  seatCycleId: z.enum(EXPECTED_SEATS),
  sourceCandidateId: z.string().regex(/^[HS]\d[A-Z]{2}\d{5}$/),
  canonicalCandidateId: z.string().regex(/^[HS]\d[A-Z]{2}\d{5}$/),
  alternateCandidateIds: z.array(z.string().regex(/^[HS]\d[A-Z]{2}\d{5}$/)),
  state: z.string().regex(/^[A-Z]{2}$/),
  district: z.string().regex(/^\d{2}$/),
  rawFecPartyCode: z.enum(["DEM", "DFL"]),
  cycleDispositions: z.array(authorityCycle).min(1),
  bulkObservations: z.array(z.string().min(1)).min(1),
  filingSourceLockIds: z.array(z.string().regex(/^fec-form[12]-\d+$/)).min(1),
  rationaleCodes: z.array(z.string().min(1)).min(1),
});

const authoritySchema = z.strictObject({
  schema: z.literal("aipac-incumbent-fec-authority-receipt-v1"),
  version: z.literal(1),
  observedAt: z.literal("2026-08-05T16:30:00.000Z"),
  evidenceCutoff: z.literal("2026-08-04"),
  reviewerOnly: z.literal(true),
  publicationEligible: z.literal(false),
  privacy: z.strictObject({ rawBulkArchivesRetained: z.literal(false), rawFilingPdfsRetained: z.literal(false), reason: z.string().min(1) }),
  bulkArchiveParent: z.strictObject({ sourceLockId: z.literal("aipac-candidate-seat-mappings-proposal-v1"), sourceArtifactIds: z.array(z.enum(["cn22", "cm22", "ccl22", "cn24", "cm24", "ccl24", "cn26", "cm26", "ccl26"])).length(9) }),
  partyAliasAuthority: z.strictObject({
    sourceLockId: z.literal("mn-dfl-about-party-affiliation-20260805"),
    url: z.literal("https://dfl.org/about/"),
    retrievedAt: z.literal("2026-08-05T17:26:00.000Z"),
    organization: z.literal("Minnesota Democratic-Farmer-Labor Party"),
    relationship: z.literal("state_party_affiliated_with_national_democratic_party"),
    rawFecPartyCode: z.literal("DFL"),
    targetPartyCode: z.literal("DEM"),
    policy: z.literal("preserve_raw_dfl_and_require_explicit_reviewable_alias"),
  }),
  cases: z.array(authorityCase).length(6),
  review: z.strictObject({ status: z.literal("analyst_candidate"), reviewer: z.null(), reviewedAt: z.null() }),
});

const cycleDisposition = z.strictObject({
  cycleYear: z.union([z.literal(2022), z.literal(2024), z.literal(2026)]),
  disposition: z.enum(["proposed_house_relationship", "office_changed_to_senate"]),
  committeeIds: z.array(z.string().regex(/^C\d{8}$/)).max(1),
  evidenceRule: authorityCycle.shape.evidenceRule,
  numericUse: z.enum(["pending_authorized_review", "excluded_not_house_candidacy"]),
});

const resolution = z.strictObject({
  sourceDecisionId: z.string().min(1),
  seatCycleId: z.enum(EXPECTED_SEATS),
  sourceCandidateId: z.string().min(1),
  canonicalCandidateId: z.string().min(1),
  alternateCandidateIds: z.array(z.string().min(1)),
  partyTreatment: z.enum(["exact_dem", "explicit_dfl_alias_required"]),
  cycleDispositions: z.array(cycleDisposition).min(1),
  sourceEvidenceRecordSha256s: z.array(SHA).min(1),
  officialFilingSourceLockIds: z.array(z.string().min(1)).min(1),
  officialFilingSha256s: z.array(SHA).min(1),
  rationaleCodes: z.array(z.string().min(1)).min(1),
  defaultEvaluatorUse: z.literal("excluded_pending_authorized_review"),
  resolutionSha256: SHA,
});

export const aipacIncumbentConflictResolutionCandidateSchema = z.strictObject({
  schema: z.literal("aipac-incumbent-conflict-resolution-candidate-v1"),
  version: z.literal(1),
  generatedAt: z.literal("2026-08-05T17:00:00.000Z"),
  sourceCutoff: z.literal("2026-08-04"),
  reviewerOnly: z.literal(true),
  publicationEligible: z.literal(false),
  defaultUse: z.literal("exclude_until_each_resolution_is_accepted_by_an_authorized_reviewer"),
  inputs: z.strictObject({
    proposalFileSha256: z.literal(PROPOSAL_FILE_SHA256),
    authorityReceiptFileSha256: z.literal(AUTHORITY_FILE_SHA256),
    partyAliasAuthoritySourceLockId: z.literal("mn-dfl-about-party-affiliation-20260805"),
    partyAliasAuthoritySha256: z.literal(PARTY_ALIAS_AUTHORITY_SHA256),
  }),
  summary: z.strictObject({
    inputConflictRelationships: z.literal(6),
    evidenceSpecificResolutionCandidates: z.literal(6),
    correctedCandidateIds: z.literal(2),
    partyAliasCandidates: z.literal(1),
    sourceScopedAliasOverrideCandidates: z.literal(1),
    officeChangeExclusions: z.literal(2),
    pendingAuthorizedMappingDecisions: z.literal(6),
    automaticallyApprovedRelationships: z.literal(0),
    remainingMethodologyAndPromotionDecisions: z.literal(4),
  }),
  resolutions: z.array(resolution).length(6),
  resolutionSetSha256: SHA,
  review: z.strictObject({ status: z.literal("proposed"), reviewer: z.null(), reviewedAt: z.null() }),
  packageSha256: SHA,
});

export type AipacIncumbentConflictResolutionCandidate = z.infer<typeof aipacIncumbentConflictResolutionCandidateSchema>;
type ProposalDecision = { decisionId: string; status: string; candidateId: string; seatCycleId: string; relationship: string; effectiveCycleYears: number[]; state: string; district: string; party: string; authorizedCommitteeIdsByCycle: Array<{ cycleYear: number; principalCommitteeCrosscheck: string }>; evidenceRecordSha256s: string[] };
type SourceLockEntry = { id: string; retainedStatus: string; sha256: string; byteSize: number; url: string };

const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");
const bytewise = (a: string, b: string): number => Buffer.compare(Buffer.from(a), Buffer.from(b));

function exactSeatSet(values: string[], code: string): void {
  if (values.length !== EXPECTED_SEATS.length || values.some((value, index) => [...EXPECTED_SEATS].sort(bytewise)[index] !== value)) throw new Error(code);
}

export function buildAipacIncumbentConflictResolutionCandidate(input: Readonly<{
  proposal: unknown;
  proposalFileSha256: string;
  authorityReceipt: unknown;
  authorityReceiptFileSha256: string;
  sourceLockEntries: SourceLockEntry[];
}>): AipacIncumbentConflictResolutionCandidate {
  if (input.proposalFileSha256 !== PROPOSAL_FILE_SHA256 || input.authorityReceiptFileSha256 !== AUTHORITY_FILE_SHA256) throw new Error("AIPAC_INCUMBENT_RESOLUTION_INPUT_HASH_MISMATCH");
  const authority = authoritySchema.parse(input.authorityReceipt);
  const proposal = input.proposal as { sourceCutoff?: unknown; proposedDecisions?: ProposalDecision[] };
  if (proposal.sourceCutoff !== "2026-08-04" || !Array.isArray(proposal.proposedDecisions)) throw new Error("AIPAC_INCUMBENT_RESOLUTION_PROPOSAL_INVALID");
  const conflicts = proposal.proposedDecisions.filter((row) => row.relationship === "incumbent" && row.status === "needs_review" && row.authorizedCommitteeIdsByCycle.some((cycle) => cycle.principalCommitteeCrosscheck === "conflict"));
  exactSeatSet(conflicts.map((row) => row.seatCycleId).sort(bytewise), "AIPAC_INCUMBENT_RESOLUTION_CONFLICT_UNIVERSE_INVALID");
  exactSeatSet(authority.cases.map((row) => row.seatCycleId).sort(bytewise), "AIPAC_INCUMBENT_RESOLUTION_AUTHORITY_UNIVERSE_INVALID");
  const entries = new Map(input.sourceLockEntries.map((entry) => [entry.id, entry]));
  const partyAliasAuthority = entries.get(authority.partyAliasAuthority.sourceLockId);
  if (!partyAliasAuthority || partyAliasAuthority.retainedStatus !== "nonretained" || partyAliasAuthority.url !== authority.partyAliasAuthority.url || partyAliasAuthority.sha256 !== PARTY_ALIAS_AUTHORITY_SHA256 || partyAliasAuthority.byteSize !== 161648) throw new Error("AIPAC_INCUMBENT_RESOLUTION_PARTY_ALIAS_AUTHORITY_MISMATCH");
  const proposalBySeat = new Map(conflicts.map((row) => [row.seatCycleId, row]));

  const resolutions = authority.cases.map((authorityCase) => {
    const source = proposalBySeat.get(authorityCase.seatCycleId);
    if (!source || source.decisionId !== authorityCase.sourceDecisionId || source.candidateId !== authorityCase.sourceCandidateId || source.state !== authorityCase.state || source.district !== authorityCase.district || source.party !== "DEM") throw new Error("AIPAC_INCUMBENT_RESOLUTION_SOURCE_RELATIONSHIP_MISMATCH");
    const filingEntries = authorityCase.filingSourceLockIds.map((id) => entries.get(id));
    if (filingEntries.some((entry) => !entry || entry.retainedStatus !== "nonretained" || !entry.url.startsWith("https://docquery.fec.gov/pdf/") || entry.byteSize <= 0)) throw new Error("AIPAC_INCUMBENT_RESOLUTION_FILING_SOURCE_LOCK_MISMATCH");
    const cycleDispositions = authorityCase.cycleDispositions.map((cycle) => {
      if (cycle.status === "office_changed_to_senate" && (cycle.cycleYear !== 2026 || cycle.committeeIds.length !== 0 || cycle.evidenceRule !== "later_form2_and_form1_different_office")) throw new Error("AIPAC_INCUMBENT_RESOLUTION_OFFICE_CHANGE_INVALID");
      if (cycle.status === "proposed_house_relationship" && cycle.committeeIds.length !== 1) throw new Error("AIPAC_INCUMBENT_RESOLUTION_COMMITTEE_REQUIRED");
      return { cycleYear: cycle.cycleYear, disposition: cycle.status, committeeIds: cycle.committeeIds, evidenceRule: cycle.evidenceRule, numericUse: cycle.status === "office_changed_to_senate" ? "excluded_not_house_candidacy" as const : "pending_authorized_review" as const };
    });
    if (authorityCase.rawFecPartyCode === "DFL" && (authorityCase.seatCycleId !== "seat_house_mn_03_current" || !cycleDispositions.every((cycle) => cycle.evidenceRule === "exact_cn_ccl_principal_match_party_alias"))) throw new Error("AIPAC_INCUMBENT_RESOLUTION_PARTY_ALIAS_INVALID");
    const unsigned = {
      sourceDecisionId: authorityCase.sourceDecisionId,
      seatCycleId: authorityCase.seatCycleId,
      sourceCandidateId: authorityCase.sourceCandidateId,
      canonicalCandidateId: authorityCase.canonicalCandidateId,
      alternateCandidateIds: [...authorityCase.alternateCandidateIds].sort(bytewise),
      partyTreatment: authorityCase.rawFecPartyCode === "DFL" ? "explicit_dfl_alias_required" as const : "exact_dem" as const,
      cycleDispositions,
      sourceEvidenceRecordSha256s: [...source.evidenceRecordSha256s].sort(bytewise),
      officialFilingSourceLockIds: [...authorityCase.filingSourceLockIds].sort(bytewise),
      officialFilingSha256s: filingEntries.map((entry) => entry!.sha256).sort(bytewise),
      rationaleCodes: authorityCase.rationaleCodes,
      defaultEvaluatorUse: "excluded_pending_authorized_review" as const,
    };
    return resolution.parse({ ...unsigned, resolutionSha256: digest("dsa-seats:aipac-incumbent-conflict-resolution:v1\0", unsigned) });
  }).sort((a, b) => bytewise(a.seatCycleId, b.seatCycleId));

  const unsigned = {
    schema: "aipac-incumbent-conflict-resolution-candidate-v1" as const,
    version: 1 as const,
    generatedAt: "2026-08-05T17:00:00.000Z" as const,
    sourceCutoff: "2026-08-04" as const,
    reviewerOnly: true as const,
    publicationEligible: false as const,
    defaultUse: "exclude_until_each_resolution_is_accepted_by_an_authorized_reviewer" as const,
    inputs: { proposalFileSha256: PROPOSAL_FILE_SHA256, authorityReceiptFileSha256: AUTHORITY_FILE_SHA256, partyAliasAuthoritySourceLockId: "mn-dfl-about-party-affiliation-20260805" as const, partyAliasAuthoritySha256: PARTY_ALIAS_AUTHORITY_SHA256 },
    summary: { inputConflictRelationships: 6 as const, evidenceSpecificResolutionCandidates: 6 as const, correctedCandidateIds: 2 as const, partyAliasCandidates: 1 as const, sourceScopedAliasOverrideCandidates: 1 as const, officeChangeExclusions: 2 as const, pendingAuthorizedMappingDecisions: 6 as const, automaticallyApprovedRelationships: 0 as const, remainingMethodologyAndPromotionDecisions: 4 as const },
    resolutions,
    resolutionSetSha256: digest("dsa-seats:aipac-incumbent-conflict-resolution-set:v1\0", resolutions),
    review: { status: "proposed" as const, reviewer: null, reviewedAt: null },
  };
  return validateAipacIncumbentConflictResolutionCandidate({ ...unsigned, packageSha256: digest("dsa-seats:aipac-incumbent-conflict-resolution-candidate:v1\0", unsigned) });
}

export function validateAipacIncumbentConflictResolutionCandidate(value: unknown): AipacIncumbentConflictResolutionCandidate {
  const parsed = aipacIncumbentConflictResolutionCandidateSchema.parse(value);
  const { packageSha256, ...unsigned } = parsed;
  if (packageSha256 !== digest("dsa-seats:aipac-incumbent-conflict-resolution-candidate:v1\0", unsigned)) throw new Error("AIPAC_INCUMBENT_RESOLUTION_PACKAGE_HASH_MISMATCH");
  if (parsed.resolutionSetSha256 !== digest("dsa-seats:aipac-incumbent-conflict-resolution-set:v1\0", parsed.resolutions)) throw new Error("AIPAC_INCUMBENT_RESOLUTION_SET_HASH_MISMATCH");
  for (const row of parsed.resolutions) {
    const { resolutionSha256, ...rowUnsigned } = row;
    if (resolutionSha256 !== digest("dsa-seats:aipac-incumbent-conflict-resolution:v1\0", rowUnsigned)) throw new Error("AIPAC_INCUMBENT_RESOLUTION_ROW_HASH_MISMATCH");
  }
  return parsed;
}
