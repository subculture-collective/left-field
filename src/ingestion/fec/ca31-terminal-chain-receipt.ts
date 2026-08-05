import { createHash } from "node:crypto";
import { z } from "zod";
import { canonicalJson } from "./aipac-proposed-packages";

const SHA = z.string().regex(/^[a-f0-9]{64}$/);
const source = z.strictObject({ sourceLockId: z.string().min(1), sha256: SHA, byteSize: z.number().int().positive() });
const pagination = z.strictObject({ count: z.number().int().nonnegative(), page: z.number().int().positive(), pages: z.number().int().nonnegative(), perPage: z.literal(100), resultCount: z.number().int().nonnegative(), terminal: z.boolean() });

export const ca31TerminalChainReceiptSchema = z.strictObject({
  schema: z.literal("ca31-terminal-fec-chain-receipt-v1"),
  version: z.literal(1),
  generatedAt: z.literal("2026-08-05T22:15:00.000Z"),
  sourceCutoff: z.literal("2026-08-04"),
  reviewerOnly: z.literal(true),
  publicationEligible: z.literal(false),
  privacy: z.strictObject({ rawApiResponsesRetained: z.literal(false), rawFilingPdfsRetained: z.literal(false), retainedFields: z.literal("identifiers_dates_form_relationship_pagination_and_content_hashes_only") }),
  acquisition: z.strictObject({ method: z.literal("live_hash_checked_openfec_json_and_pdftotext_projection"), observedProjectionSha256: SHA }),
  sources: z.strictObject({
    h8Form2Page1: source, h8Form2TerminalPage: source, h4Form2Page1: source, h4Form2TerminalPage: source,
    committeeForm1Page1: source, committeeForm1TerminalPage: source, form2Election2024Pdf: source, form2Election2026Pdf: source, form1InitialPdf: source, form1TerminalPdf: source,
  }),
  pagination: z.strictObject({
    h8Form2Page1: pagination, h8Form2Page2: pagination, h4Form2Page1: pagination, h4Form2Page2: pagination, committeeForm1Page1: pagination, committeeForm1Page2: pagination,
  }),
  chronology: z.tuple([
    z.strictObject({ date: z.literal("2023-09-12"), form: z.literal("F1"), fileNumber: z.literal(1724934), amendmentIndicator: z.literal("N"), amendmentVersion: z.literal(0), committeeId: z.literal("C00850420"), committeeName: z.literal("CISNEROS FOR CONGRESS"), mostRecentAtCutoff: z.literal(false), sourceLockId: z.literal("fec-form1-1724934") }),
    z.strictObject({ date: z.literal("2023-09-12"), form: z.literal("F2"), fileNumber: z.literal(-1150856), amendmentIndicator: z.literal("N"), amendmentVersion: z.literal(5), electionYear: z.literal(2024), apiCandidateId: z.literal("H8CA39174"), signedFormCandidateId: z.literal("H4CA31170"), office: z.literal("House"), state: z.literal("CA"), district: z.literal("31"), principalCommitteeName: z.literal("Cisneros for Congress"), sourceLockId: z.literal("fec-form2-ca31-20230912") }),
    z.strictObject({ date: z.literal("2024-09-10"), form: z.literal("F1"), fileNumber: z.literal(1814721), previousFileNumber: z.literal(1724934), amendmentChain: z.tuple([z.literal(1724934), z.literal(1814721)]), amendmentIndicator: z.literal("A"), amendmentVersion: z.literal(1), committeeId: z.literal("C00850420"), committeeName: z.literal("CISNEROS FOR CONGRESS"), mostRecentAtCutoff: z.literal(true), sourceLockId: z.literal("fec-form1-1814721") }),
    z.strictObject({ date: z.literal("2024-11-15"), form: z.literal("F2"), fileNumber: z.literal(-1150858), amendmentIndicator: z.literal("N"), amendmentVersion: z.literal(6), electionYear: z.literal(2026), apiCandidateId: z.literal("H8CA39174"), signedFormCandidateId: z.literal("H4CA31170"), office: z.literal("House"), state: z.literal("CA"), district: z.literal("31"), principalCommitteeName: z.literal("Cisneros for Congress"), mostRecentAtCutoff: z.literal(true), sourceLockId: z.literal("fec-form2-1818491") }),
  ]),
  conclusion: z.strictObject({
    seatCycleId: z.literal("seat_house_ca_31_current"), cycleYear: z.literal(2024), canonicalCandidateId: z.literal("H8CA39174"), signedFormCandidateId: z.literal("H4CA31170"), committeeId: z.literal("C00850420"),
    disposition: z.literal("auto_verified_house_relationship"), provenanceKind: z.literal("direct_cross_surface"), confidence: z.literal("certain_relationship_with_unresolved_cross_surface_identifier_discrepancy"), closureScope: z.literal("person_seat_cycle_and_committee_relationship_only"), identifierMappingResolved: z.literal(false), unresolvedIdentifierConflict: z.literal(true),
    relationshipBasis: z.literal("the_2024_form2_names_cisneros_for_congress_and_the_same_day_initial_form1_identifies_that_committee_as_C00850420_while_the_terminal_form1_amendment_preserves_the_relationship"),
    identifierTreatment: z.literal("preserve_H8CA39174_as_roster_and_openfec_index_id_and_H4CA31170_as_the_conflicting_signed_form_value_without_claiming_the_ids_are_identical"),
    supersessionFinding: z.literal("no_later_form1_for_C00850420_or_form2_in_the_queried_H8_H4_indexes_through_cutoff_changes_the_observed_relationship"),
    rationaleCodes: z.tuple([z.literal("CYCLE_2024_FORM2_DIRECT_COMMITTEE_NAME"), z.literal("SAME_DAY_FORM1_EXACT_COMMITTEE_ID"), z.literal("TERMINAL_FORM1_CHAIN_PRESERVES_RELATIONSHIP"), z.literal("FORM2_TERMINAL_PAGE_EXHAUSTIVE"), z.literal("H8_H4_CROSS_SURFACE_IDENTIFIER_DISCREPANCY_RETAINED")]),
  }),
  automaticDecisionClosure: z.strictObject({ decisionId: z.literal("aipac-mapping-precedence:incumbent:seat_house_ca_31_current:2024:H8CA39174"), closureKind: z.literal("mechanically_verified_official_evidence"), reviewerAction: z.literal(false), reviewer: z.null(), reviewedAt: z.null() }),
  evidenceSetSha256: SHA,
  packageSha256: SHA,
});

export type Ca31TerminalChainReceipt = z.infer<typeof ca31TerminalChainReceiptSchema>;
type SourceLockEntry = Readonly<{ id: string; sha256: string; byteSize: number }>;
export type Ca31TerminalObservation = Readonly<{
  pagination: z.infer<typeof ca31TerminalChainReceiptSchema>["pagination"];
  form2Election2024: { fileNumber: number; receiptDate: string; electionYear: number; amendmentIndicator: string; amendmentVersion: number; apiCandidateId: string; pdfUrl: string };
  form2Election2026: { fileNumber: number; receiptDate: string; electionYear: number; amendmentIndicator: string; amendmentVersion: number; apiCandidateId: string; pdfUrl: string; mostRecent: boolean };
  form1Initial: { fileNumber: number; receiptDate: string; amendmentIndicator: string; amendmentVersion: number; committeeId: string; committeeName: string };
  form1Terminal: { fileNumber: number; receiptDate: string; amendmentIndicator: string; amendmentVersion: number; previousFileNumber: number; amendmentChain: number[]; committeeId: string; committeeName: string; mostRecent: boolean };
  pdfFacts: { form2Election2024: string[]; form2Election2026: string[]; form1Initial: string[]; form1Terminal: string[] };
}>;
const hash = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");

const expected = {
  h8Form2Page1: ["openfec-ca31-h8-form2-cutoff-page1", "8756704ba117be927bd4713ba6bbcda4ce885af9b08cae8058a1740e8ec8f973", 13245],
  h8Form2TerminalPage: ["openfec-ca31-h8-form2-cutoff-page2", "665675f2388822696c0995353a9e1b7d469c8de5ef205db470bc2f26229587cd", 116],
  h4Form2Page1: ["openfec-ca31-h4-form2-cutoff-page1", "606d2de1acd6801422e7afe71f034ecbebe14ae036c6c9ac0b280de50ca6aa7c", 116],
  h4Form2TerminalPage: ["openfec-ca31-h4-form2-cutoff-page2", "caa0a11b4baa918f09573a700beec1e1f5c78ba48f2ef636231e35a6fa1688f4", 116],
  committeeForm1Page1: ["openfec-ca31-committee-form1-cutoff-page1", "d090f7ec614cb4d71e2dd85e6270c7f9538660d6a07cb5f30b0a376a37f0c619", 3963],
  committeeForm1TerminalPage: ["openfec-ca31-committee-form1-cutoff-page2", "70c9fada93b72d7d1da7874944af2b156f6b6d0b7778eecd8a7b8f8393b995d1", 116],
  form2Election2024Pdf: ["fec-form2-ca31-20230912", "745afc3642b231dc9c4d6e1810c01c7f49f48dcdabacdd9eb7500f9dc483469f", 12485],
  form2Election2026Pdf: ["fec-form2-1818491", "07f6e5ea56aa7170d57d311a4f5df851200e1f5535d523bc89fd270c53a24ab3", 12776],
  form1InitialPdf: ["fec-form1-1724934", "c83f9252e9699bfc80b4f56b6715e86ac9380a96c53665182add2af4241b5568", 60742],
  form1TerminalPdf: ["fec-form1-1814721", "288cedd1da118063a926326c7794a29d4219cce739d94a11b864e87f12000433", 60760],
} as const;

export const CA31_TERMINAL_OBSERVATION_CONTRACT: Ca31TerminalObservation = {
    pagination: { h8Form2Page1: { count: 7, page: 1, pages: 1, perPage: 100, resultCount: 7, terminal: false }, h8Form2Page2: { count: 7, page: 2, pages: 1, perPage: 100, resultCount: 0, terminal: true }, h4Form2Page1: { count: 0, page: 1, pages: 0, perPage: 100, resultCount: 0, terminal: true }, h4Form2Page2: { count: 0, page: 2, pages: 0, perPage: 100, resultCount: 0, terminal: true }, committeeForm1Page1: { count: 2, page: 1, pages: 1, perPage: 100, resultCount: 2, terminal: false }, committeeForm1Page2: { count: 2, page: 2, pages: 1, perPage: 100, resultCount: 0, terminal: true } },
    form2Election2024: { fileNumber: -1150856, receiptDate: "2023-09-12T00:00:00", electionYear: 2024, amendmentIndicator: "N", amendmentVersion: 5, apiCandidateId: "H8CA39174", pdfUrl: "https://docquery.fec.gov/pdf/252/202309129597027252/202309129597027252.pdf" },
    form2Election2026: { fileNumber: -1150858, receiptDate: "2024-11-15T00:00:00", electionYear: 2026, amendmentIndicator: "N", amendmentVersion: 6, apiCandidateId: "H8CA39174", pdfUrl: "https://docquery.fec.gov/pdf/235/202411159719978235/202411159719978235.pdf", mostRecent: true },
    form1Initial: { fileNumber: 1724934, receiptDate: "2023-09-12T00:00:00", amendmentIndicator: "N", amendmentVersion: 0, committeeId: "C00850420", committeeName: "CISNEROS FOR CONGRESS" },
    form1Terminal: { fileNumber: 1814721, receiptDate: "2024-09-10T00:00:00", amendmentIndicator: "A", amendmentVersion: 1, previousFileNumber: 1724934, amendmentChain: [1724934, 1814721], committeeId: "C00850420", committeeName: "CISNEROS FOR CONGRESS", mostRecent: true },
    pdfFacts: { form2Election2024: ["H4CA31170", "2024", "House", "CA", "31", "Cisneros for Congress"], form2Election2026: ["H4CA31170", "2026", "House", "CA", "31", "Cisneros for Congress"], form1Initial: ["C00850420", "Cisneros for Congress", "Cisneros, Gilbert", "DEM", "House", "CA", "31"], form1Terminal: ["C00850420", "Cisneros for Congress", "Cisneros, Gilbert", "DEM", "House", "CA", "31"] },
} as const;
function validateObservation(observed: Ca31TerminalObservation): void {
  if (canonicalJson(observed) !== canonicalJson(CA31_TERMINAL_OBSERVATION_CONTRACT)) throw new Error("CA31_TERMINAL_CHAIN_OBSERVED_CONTENT_MISMATCH");
}

export function buildCa31TerminalChainReceipt(entries: readonly SourceLockEntry[], observed: Ca31TerminalObservation): Ca31TerminalChainReceipt {
  validateObservation(observed);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const sources = Object.fromEntries(Object.entries(expected).map(([key, [id, sha256, byteSize]]) => {
    const entry = byId.get(id);
    if (!entry || entry.sha256 !== sha256 || entry.byteSize !== byteSize) throw new Error(`CA31_TERMINAL_CHAIN_SOURCE_LOCK_MISMATCH:${id}`);
    return [key, { sourceLockId: id, sha256, byteSize }];
  })) as z.infer<typeof ca31TerminalChainReceiptSchema>["sources"];
  const paginationEvidence = observed.pagination;
  const chronology = [
    { date: "2023-09-12", form: "F1", fileNumber: 1724934, amendmentIndicator: "N", amendmentVersion: 0, committeeId: "C00850420", committeeName: "CISNEROS FOR CONGRESS", mostRecentAtCutoff: false, sourceLockId: "fec-form1-1724934" },
    { date: "2023-09-12", form: "F2", fileNumber: -1150856, amendmentIndicator: "N", amendmentVersion: 5, electionYear: 2024, apiCandidateId: "H8CA39174", signedFormCandidateId: "H4CA31170", office: "House", state: "CA", district: "31", principalCommitteeName: "Cisneros for Congress", sourceLockId: "fec-form2-ca31-20230912" },
    { date: "2024-09-10", form: "F1", fileNumber: 1814721, previousFileNumber: 1724934, amendmentChain: [1724934, 1814721], amendmentIndicator: "A", amendmentVersion: 1, committeeId: "C00850420", committeeName: "CISNEROS FOR CONGRESS", mostRecentAtCutoff: true, sourceLockId: "fec-form1-1814721" },
    { date: "2024-11-15", form: "F2", fileNumber: -1150858, amendmentIndicator: "N", amendmentVersion: 6, electionYear: 2026, apiCandidateId: "H8CA39174", signedFormCandidateId: "H4CA31170", office: "House", state: "CA", district: "31", principalCommitteeName: "Cisneros for Congress", mostRecentAtCutoff: true, sourceLockId: "fec-form2-1818491" },
  ] as const;
  const conclusion = { seatCycleId: "seat_house_ca_31_current", cycleYear: 2024, canonicalCandidateId: "H8CA39174", signedFormCandidateId: "H4CA31170", committeeId: "C00850420", disposition: "auto_verified_house_relationship", provenanceKind: "direct_cross_surface", confidence: "certain_relationship_with_unresolved_cross_surface_identifier_discrepancy", closureScope: "person_seat_cycle_and_committee_relationship_only", identifierMappingResolved: false, unresolvedIdentifierConflict: true, relationshipBasis: "the_2024_form2_names_cisneros_for_congress_and_the_same_day_initial_form1_identifies_that_committee_as_C00850420_while_the_terminal_form1_amendment_preserves_the_relationship", identifierTreatment: "preserve_H8CA39174_as_roster_and_openfec_index_id_and_H4CA31170_as_the_conflicting_signed_form_value_without_claiming_the_ids_are_identical", supersessionFinding: "no_later_form1_for_C00850420_or_form2_in_the_queried_H8_H4_indexes_through_cutoff_changes_the_observed_relationship", rationaleCodes: ["CYCLE_2024_FORM2_DIRECT_COMMITTEE_NAME", "SAME_DAY_FORM1_EXACT_COMMITTEE_ID", "TERMINAL_FORM1_CHAIN_PRESERVES_RELATIONSHIP", "FORM2_TERMINAL_PAGE_EXHAUSTIVE", "H8_H4_CROSS_SURFACE_IDENTIFIER_DISCREPANCY_RETAINED"] } as const;
  const acquisition = { method: "live_hash_checked_openfec_json_and_pdftotext_projection", observedProjectionSha256: hash("dsa-seats:ca31-terminal-observed-projection:v1\0", observed) } as const;
  const evidenceSetSha256 = hash("dsa-seats:ca31-terminal-chain-evidence:v1\0", { sources, acquisition, pagination: paginationEvidence, chronology, conclusion });
  const unsigned = { schema: "ca31-terminal-fec-chain-receipt-v1", version: 1, generatedAt: "2026-08-05T22:15:00.000Z", sourceCutoff: "2026-08-04", reviewerOnly: true, publicationEligible: false, privacy: { rawApiResponsesRetained: false, rawFilingPdfsRetained: false, retainedFields: "identifiers_dates_form_relationship_pagination_and_content_hashes_only" }, acquisition, sources, pagination: paginationEvidence, chronology, conclusion, automaticDecisionClosure: { decisionId: "aipac-mapping-precedence:incumbent:seat_house_ca_31_current:2024:H8CA39174", closureKind: "mechanically_verified_official_evidence", reviewerAction: false, reviewer: null, reviewedAt: null }, evidenceSetSha256 } as const;
  return validateCa31TerminalChainReceipt({ ...unsigned, packageSha256: hash("dsa-seats:ca31-terminal-chain-receipt:v1\0", unsigned) });
}

export function validateCa31TerminalChainReceipt(value: unknown): Ca31TerminalChainReceipt {
  const parsed = ca31TerminalChainReceiptSchema.parse(value), { packageSha256, ...unsigned } = parsed;
  if (packageSha256 !== hash("dsa-seats:ca31-terminal-chain-receipt:v1\0", unsigned)) throw new Error("CA31_TERMINAL_CHAIN_PACKAGE_HASH_MISMATCH");
  const evidence = { sources: parsed.sources, acquisition: parsed.acquisition, pagination: parsed.pagination, chronology: parsed.chronology, conclusion: parsed.conclusion };
  if (parsed.evidenceSetSha256 !== hash("dsa-seats:ca31-terminal-chain-evidence:v1\0", evidence)) throw new Error("CA31_TERMINAL_CHAIN_EVIDENCE_HASH_MISMATCH");
  if (parsed.pagination.h8Form2Page1.terminal || !parsed.pagination.h8Form2Page2.terminal || parsed.pagination.h8Form2Page2.resultCount !== 0 || parsed.pagination.h4Form2Page1.count !== 0 || parsed.pagination.committeeForm1Page1.terminal || !parsed.pagination.committeeForm1Page2.terminal || parsed.pagination.committeeForm1Page2.resultCount !== 0) throw new Error("CA31_TERMINAL_CHAIN_PAGINATION_INCOMPLETE");
  if (parsed.conclusion.identifierMappingResolved || !parsed.conclusion.unresolvedIdentifierConflict || parsed.conclusion.closureScope !== "person_seat_cycle_and_committee_relationship_only") throw new Error("CA31_TERMINAL_CHAIN_IDENTIFIER_SCOPE_INVALID");
  if (parsed.automaticDecisionClosure.reviewerAction || parsed.automaticDecisionClosure.reviewer !== null || parsed.automaticDecisionClosure.reviewedAt !== null) throw new Error("CA31_TERMINAL_CHAIN_FABRICATED_REVIEW");
  return parsed;
}
