import { createHash, createPublicKey } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { computeReleaseDigest, contentDomains, domainSummary, expectedContentChecksum } from "./catalog-release";
import { loadNationwideManifest } from "./manifest";
import { computeCanonicalDataChecksum } from "@/domain/validate-manifest";
import { encodeFecAcquisitionPlan, fecAcquisitionPlanSha256, fecTargetUniverseSha256, type FecAcquisitionPlanV2, type FecPlanTarget } from "@/ingestion/fec/acquisition-plan";
import { fecV2ReceiptSetDigestSha256 } from "@/ingestion/fec/snapshot-digest";
import { isFecCandidateId } from "@/ingestion/fec/values";
import { decodeFecEnumerationPage, decodeFecFilingLedger, encodeFecEnumerationPage, encodeFecFilingLedger, fecFilingIdentitySha256, fecPassOccurrenceDigestSha256, fecSourcePageIdentitySha256, type FecCodecOptions, type FecFilingIdentityV1, type FecMultiplicity } from "@/ingestion/fec/filing-ledger";
import { decodeFecSanitizedFilingArtifact, encodeFecSanitizedFilingArtifact, FEC_SANITIZED_FILING_SCHEMA } from "@/ingestion/fec/efo-sanitizer";

const digestDomains = ["acs", "elections", "finance", "geography", "identity", "maps", "member"] as const;
const terminalOutcomes = ["approved_finance", "vacancy", "no_declared_cycle", "no_authorized_committee", "no_report"] as const;
const subjectTypes = ["fec_mapping", "committee_mapping", "finance_page_closure", "finance_amendment_closure", "vacancy", "finance_terminal", "finance_closure", "election_decision", "election_result", "election_geometry", "outside_spending_election_mapping", "outside_spending_closure", "publication"] as const;
export type SubjectType = (typeof subjectTypes)[number];
export type ReviewerRole = "data_reviewer" | "release_approver";
type Scalar = string | number | bigint | boolean | null | Date;
type Row = Record<string, Scalar | readonly Scalar[] | Record<string, Scalar>>;
type ReviewFields = { release_id: string; review_id: string; subject_sha256: string };

export interface FinanceEvidence {
  profile: readonly (Row & { seat_cycle_id: string; occupancy_status: string })[];
  receipts: readonly (Row & { id: string; usage_status: string })[];
  deletions: readonly (Row & { receipt_id: string; attestation_sha256: string })[];
  mappings: readonly (Row & ReviewFields & { seat_cycle_id: string; outcome: string; receipt_id: string; fec_candidate_id: string | null })[];
  committees: readonly (Row & ReviewFields & { seat_cycle_id: string; fec_candidate_id: string; committee_id: string; receipt_id: string })[];
  pages: readonly (Row & ReviewFields & { seat_cycle_id: string; acquisition_batch: string })[];
  amendments: readonly (Row & ReviewFields & { seat_cycle_id: string; committee_id: string; report_type: string; reporting_period_start: string; reporting_period_end: string })[];
  filings: readonly (Row & { id: string; seat_cycle_id: string; committee_id: string; report_type: string; reporting_period_start: string; reporting_period_end: string; source_filing_id: string; amendment_number: number | string; amendment_status: string; amends_filing_id: string | null; filed_at: Date | string })[];
  vacancies: readonly (Row & ReviewFields & { seat_cycle_id: string; receipt_id: string })[];
  terminals: readonly (Row & ReviewFields & { seat_cycle_id: string; outcome: string })[];
  coverage: readonly (Row & ReviewFields & { seat_cycle_id: string; kind: string; status: string })[];
}

export interface ElectionEvidence {
  decisions: readonly (Row & { id: string; election_year: number | string; status: string })[];
  receipts: readonly (Row & { id: string; usage_status: string })[];
  inventory: readonly (Row & ReviewFields & { id: string; decision_run_id: string; election_year: number | string; jurisdiction_code: string; contest_key: string; boundary_kind: string; inventory_receipt_id: string })[];
  authority: readonly (Row & { id: string; receipt_id: string | null; jurisdiction_code: string; election_year: number | string; certification_status: string })[];
  envelopes: readonly (Row & ReviewFields & { id: string; inventory_row_id: string; authority_artifact_id: string; disposition: string; denominator_votes: string | number | bigint | null; certification_status: string | null })[];
  resultTotals: readonly (Row & { envelope_id: string; option_key: string; votes: string | number | bigint })[];
  lineage: readonly (Row & { envelope_id: string; receipt_id: string })[];
  geometry: readonly (Row & ReviewFields & { contest_key: string; required: number | string; receipt_id: string | null })[];
}

export type FinanceCanonicalPayload = { kind: "finance"; proof: FinancePublicationProof; evidence: FinanceEvidence; digests: readonly DigestRow[] };
export type ElectionCanonicalPayload = { kind: "election"; proof: ElectionPublicationProof; evidence: ElectionEvidence; digests: readonly DigestRow[] };
export type CanonicalPayload = FinanceCanonicalPayload | ElectionCanonicalPayload;
type DigestRow = { domain: string; row_count: number | string; sha256: string };
type SignatureRow = {
  review_id: string;
  subject_type: SubjectType;
  subject_sha256: string;
  reviewer_id: string;
  signed_at: Date | string;
  signature: string;
  key_id: string;
};

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
export const signedReviewSchema = z.object({ reviewId: z.string().min(1), subjectType: z.enum(subjectTypes), subjectSha256: sha256, reviewerId: z.string().min(1), signedAt: z.string().datetime({ offset: true }), signature: z.string().min(1), keyId: z.string().min(1) }).strict();
export type SignedReview = z.infer<typeof signedReviewSchema>;
export const financePublicationProofSchema = z.object({ proofId: z.string().min(1), releaseId: z.string().min(1), cutoff: z.literal("2026-07-18"), summaryDispositions: z.literal(541), financeCoverageRows: z.literal(2164), terminalOutcomes: z.array(z.enum(terminalOutcomes)).min(1), unresolvedMappings: z.literal(0), paginationGaps: z.literal(0), amendmentGaps: z.literal(0), digestDomains: z.tuple(digestDomains.map(value => z.literal(value)) as [z.ZodLiteral<"acs">, z.ZodLiteral<"elections">, z.ZodLiteral<"finance">, z.ZodLiteral<"geography">, z.ZodLiteral<"identity">, z.ZodLiteral<"maps">, z.ZodLiteral<"member">]) }).strict();
export const electionPublicationProofSchema = z.object({ proofId: z.string().min(1), releaseId: z.string().min(1), cutoff: z.literal("2026-07-18"), decisionRuns: z.literal(158), decisionYears: z.object({ 2020: z.literal(51), 2022: z.literal(56), 2024: z.literal(51) }).strict(), digestDomains: z.tuple(digestDomains.map(value => z.literal(value)) as [z.ZodLiteral<"acs">, z.ZodLiteral<"elections">, z.ZodLiteral<"finance">, z.ZodLiteral<"geography">, z.ZodLiteral<"identity">, z.ZodLiteral<"maps">, z.ZodLiteral<"member">]) }).strict();
export type FinancePublicationProof = z.infer<typeof financePublicationProofSchema>;
export type ElectionPublicationProof = z.infer<typeof electionPublicationProofSchema>;
export const fecV2PublicationProofSchema = z.object({ proofId: z.string().min(1), releaseId: z.string().min(1), planSha256: sha256 }).strict();
export type FecV2PublicationProof = z.infer<typeof fecV2PublicationProofSchema>;
type FecV2Scalar = string | number | bigint | boolean | null | Date;
interface FecV2PlanRow { plan_sha256: string; origin_release_id: string; receipt_cutoff: string | Date; campaign_cycle: number; source_lock_sha256: string; target_universe_sha256: string; canonical_sha256: string; sealed_at: string | Date | null; }
interface FecV2TargetRow { plan_sha256: string; seat_cycle_id: string; kind: string; disposition: string | null; evidence_sha256: string | null; }
interface FecV2SnapshotRow { snapshot_id: string; source_id: string; source_url: string; published_at: string | Date | null; retrieved_at: string | Date; checksum_sha256: string; parser_version: string; license: string; usage_status: string; origin_release_id: string; receipt_set_digest_sha256: string; sealed_at: string | Date | null; }
interface FecV2ReceiptRow { receipt_id: string; plan_sha256: string; artifact_sha256: string; artifact_kind: string; canonical_byte_size: bigint | string; upstream_entity_sha256: string | null; object_key: string; version_id: string; etag: string; byte_size: bigint | string; retrieved_at: string | Date; snapshot_id: string; }
export interface FecV2GraphRow { readonly [key: string]: FecV2Scalar; }
type FecV2Row = FecV2GraphRow;
export type FecV2ArtifactDescriptor = Readonly<{ receiptId: string; objectKey: string; versionId: string; etag: string; artifactSha256: string; byteSize: string; artifactKind: string; upstreamEntitySha256: string | null; retrievedAt: string; snapshotId: string; planSha256: string }>;
type FecV2TranscriptCommon = Readonly<FecV2ArtifactDescriptor & { replaySha256: string; replayByteSize: string; replayArtifactKind: string; canonicalDecodeVersion: "1" }>;
type FecV2EnumerationDecoded = Readonly<{ kind: "enumeration_page"; schema: "fec-v2-enumeration-page-v1"; version: 1; planSha256: string; provenance: { kind: "daily_partition"; formType: "F3" | "F3X" | "F24" | "F5"; receiptDate: string } | { kind: "predecessor_lookup"; formType: "F3" | "F3X" | "F24" | "F5"; requestedFileNumber: number }; pass: 1 | 2; pageNumber: number; terminal: boolean; records: readonly { occurrenceIndex: number; identity: FecFilingIdentityV1; entryIdentitySha256: string }[]; recordMultiplicity: readonly FecMultiplicity[] }>;
type FecV2LedgerDecoded = Readonly<{ kind: "filing_ledger"; schema: "fec-v2-filing-ledger-v1"; version: 1; planSha256: string; entries: readonly { identity: FecFilingIdentityV1; entryIdentitySha256: string }[]; sourcePageIdentities: readonly string[]; pass1DigestSha256: string; pass2DigestSha256: string; stable: true }>;
type FecV2SanitizedDecoded = Readonly<{ kind: "sanitized_filing"; fileNumber: number; ledgerIdentitySha256: string; reportDate: string | null; candidateIds: readonly string[]; scopeConclusion: "inside_candidate_targets" | "outside_candidate_targets"; semanticSha256: string }>;
export type FecV2ArtifactTranscript = FecV2TranscriptCommon & ({ artifactKind: "enumeration_page"; replayArtifactKind: "enumeration_page"; canonicalSchema: "fec-v2-enumeration-page-v1"; decoded: FecV2EnumerationDecoded } | { artifactKind: "filing_ledger"; replayArtifactKind: "filing_ledger"; canonicalSchema: "fec-v2-filing-ledger-v1"; decoded: FecV2LedgerDecoded } | { artifactKind: "sanitized_filing"; replayArtifactKind: "sanitized_filing"; canonicalSchema: typeof FEC_SANITIZED_FILING_SCHEMA; decoded: FecV2SanitizedDecoded });
export interface FecV2ArtifactBuildOptions extends FecCodecOptions { readonly targetCandidateIds?: readonly string[]; }
/** Reads the immutable, version-pinned canonical artifact bytes and nothing else. */
export type FecV2ReplayControls = Readonly<{ signal: AbortSignal; deadlineMs: number }>;
export interface FecV2ArtifactVerifier { readCanonicalBytes(descriptor: FecV2ArtifactDescriptor, options: FecV2ReplayControls): Promise<Uint8Array>; }
const fecV2ArtifactBundleBrand: unique symbol = Symbol("fecV2ArtifactBundle");
/** Opaque replay capability, minted only after artifacts are read outside lifecycle locks. */
export type FecV2ArtifactVerificationBundle = Readonly<{
  readonly proofReleaseId: string;
  readonly proofPlanSha256: string;
  readonly transcript: readonly FecV2ArtifactTranscript[];
  readonly [fecV2ArtifactBundleBrand]: true;
}>;
export type FecV2CanonicalPayload = Readonly<{ schemaVersion: 2; kind: "fec_v2_exact_election"; proof: FecV2PublicationProof; release: { id: string; sourceCutoff: string }; route: { route: string; planSha256: string }; plan: FecV2GraphRow; targets: readonly FecV2GraphRow[]; sourceSnapshots: readonly FecV2GraphRow[]; artifacts: readonly FecV2GraphRow[]; receipts: readonly FecV2ArtifactDescriptor[]; enumerationPages: readonly FecV2GraphRow[]; filingLedgers: readonly FecV2GraphRow[]; filingLedgerEntries: readonly FecV2GraphRow[]; pageLineage: readonly FecV2GraphRow[]; amendmentLinks: readonly FecV2GraphRow[]; sanitizedFilings: readonly FecV2GraphRow[]; alternateScoping: readonly FecV2GraphRow[]; mappings: readonly FecV2GraphRow[]; committees: readonly FecV2GraphRow[]; elections: readonly FecV2GraphRow[]; closures: readonly FecV2GraphRow[]; closureReceipts: readonly FecV2GraphRow[]; closureSnapshots: readonly FecV2GraphRow[]; coverage: readonly FecV2GraphRow[]; aggregates: readonly FecV2GraphRow[]; dataSignatures: readonly FecV2GraphRow[]; manifest: FecV2GraphRow; nationwideGate: FecV2GraphRow; digests: readonly DigestRow[] }>;
export type LaunchProofCode = "LAUNCH_PROOF_MALFORMED" | "LAUNCH_PROOF_SIGNATURE" | "LAUNCH_PROOF_RELEASE" | "LAUNCH_PROOF_CUTOFF" | "LAUNCH_PROOF_COUNTS" | "LAUNCH_PROOF_HASH" | "LAUNCH_PROOF_DIGESTS" | "LAUNCH_PROOF_MISSING" | "LAUNCH_PROOF_ARTIFACT";
export class LaunchProofError extends Error { constructor(readonly code: LaunchProofCode) { super(code); } }
export interface ResolvedPublicKey { publicKey: string; publicKeyFingerprint: string; reviewerRole: ReviewerRole; allowedSubjectTypes: readonly SubjectType[]; validFrom: Date; validUntil: Date | null; revokedAt: Date | null; }
export interface PublicKeyResolver { resolve(keyId: string, reviewerId: string): Promise<ResolvedPublicKey | undefined>; }
export interface SignatureVerifier { verify(payload: string, signature: string, publicKey: string): Promise<boolean>; }
export interface LaunchArtifactReader { read(receipt: { storeKind: "local" | "s3"; storeLocator: string; objectKey: string; sha256: string; byteSize: number; versionId?: string; etag?: string }): Promise<Uint8Array>; }
export interface LaunchArtifactStoreResolver { resolve(storeKind: "local" | "s3", storeIdentity: string): Promise<LaunchArtifactReader | undefined>; }

function fail(code: LaunchProofCode): never { throw new LaunchProofError(code); }
const evidenceAs = <T>(input: unknown): T => input as T;
const ascii = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const text = (value: unknown): string | undefined => value === null || value === undefined ? undefined : String(value);
const exact = (left: unknown, right: unknown): boolean => left === right || (left !== null && left !== undefined && right !== null && right !== undefined && String(left) === String(right));
function canonicalValue(input: Scalar | readonly Scalar[] | Record<string, Scalar>): unknown { if (input instanceof Date) return input.toISOString(); if (Array.isArray(input)) return input.map(canonicalValue); if (input && typeof input === "object") return Object.fromEntries(Object.entries(input).sort(([a], [b]) => ascii(a, b)).map(([key, item]) => [key, canonicalValue(item)])); return typeof input === "bigint" ? input.toString() : input; }
export const canonical = (input: unknown): string => JSON.stringify(canonicalValue(input as Scalar | readonly Scalar[] | Record<string, Scalar>));
export const canonicalSha256 = (input: unknown): string => createHash("sha256").update(canonical(input)).digest("hex");
export function canonicalReviewSubject(subjectType: SubjectType, row: Row): Record<string, unknown> {
  // Data-review signatures authenticate clone-stable facts. The release-scoped
  // publication signature binds those reviewed facts to one candidate release.
  const subject = { ...row };
  if (subjectType === "committee_mapping") {
    const effectiveFrom = subject.effective_from;
    if (effectiveFrom instanceof Date || typeof effectiveFrom === "string") {
      const date = sourceCutoff(effectiveFrom);
      if (date) subject.effective_from = date;
    }
  }
  delete subject.release_id;
  delete subject.review_id;
  delete subject.subject_sha256;
  return { subjectType, ...canonicalValue(subject as Record<string, Scalar>) as Record<string, unknown> };
}
export const reviewSubjectSha256 = (subjectType: SubjectType, row: Row): string => canonicalSha256(canonicalReviewSubject(subjectType, row));
export function sourceCutoff(input: Date | string): string | undefined { const date = input instanceof Date ? input : new Date(input.length === 10 ? `${input}T00:00:00.000Z` : input); return Number.isNaN(date.valueOf()) ? undefined : date.toISOString().slice(0, 10); }

function unique<T>(rows: readonly T[], key: (row: T) => string): Map<string, T> { const result = new Map<string, T>(); for (const row of rows) { const index = key(row); if (result.has(index)) fail("LAUNCH_PROOF_COUNTS"); result.set(index, row); } return result; }
function grouped<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> { const result = new Map<string, T[]>(); for (const row of rows) { const index = key(row); result.set(index, [...(result.get(index) ?? []), row]); } return result; }
function decimal(input: unknown): bigint { const raw = text(input); if (!raw || !/^\d+$/.test(raw)) fail("LAUNCH_PROOF_COUNTS"); return BigInt(raw as string); }
function approvedReceipt(row: Row, finance: boolean): boolean {
  const storeKind = text(row.raw_store_kind);
  const local = storeKind === "local" && row.version_id === null && row.etag === null;
  const s3 = storeKind === "s3" && !!text(row.version_id) && !!text(row.etag);
  const objectKey = text(row.object_key);
  return text(row.usage_status) === "approved" && !!text(row.source_url) && !!text(row.source_lock_entry_id) && decimal(row.byte_size) > BigInt(0) && !!text(row.store_identity) && !!objectKey && !/(^\/|\\|(^|\/)\.\.(\/|$))/.test(objectKey) && (local || s3) && !!text(row[finance ? "acquisition_batch" : "authority"]) && !!text(row[finance ? "request_sha256" : "sha256"]) && !!text(row[finance ? "response_sha256" : "version"]);
}
function requireSubjects(rows: readonly (Row & ReviewFields)[], type: SubjectType): void { const reviewSubjects = new Map<string, string>(); for (const row of rows) { const hash = reviewSubjectSha256(type, row); if (row.subject_sha256 !== hash) fail("LAUNCH_PROOF_HASH"); const prior = reviewSubjects.get(row.review_id); if (prior && prior !== hash) fail("LAUNCH_PROOF_SIGNATURE"); reviewSubjects.set(row.review_id, hash); } }

export function validateFinanceEvidence(evidence: FinanceEvidence, proof?: FinancePublicationProof): void {
  const { profile, receipts, deletions, mappings, committees, pages, amendments, filings, vacancies, terminals, coverage } = evidence;
  const chain = (row: { seat_cycle_id: string; committee_id: string; report_type: string; reporting_period_start: string; reporting_period_end: string }) => `${row.seat_cycle_id}\u0000${row.committee_id}\u0000${row.report_type}\u0000${row.reporting_period_start}\u0000${row.reporting_period_end}`;
  const terminal = unique(terminals, row => row.seat_cycle_id); const mapping = unique(mappings, row => row.seat_cycle_id); const vacancy = unique(vacancies, row => row.seat_cycle_id); unique(amendments, chain);
  const receipt = unique(receipts, row => row.id); const deletion = unique(deletions, row => row.receipt_id); unique(coverage, row => `${row.seat_cycle_id}\u0000${row.kind}`); unique(pages, row => `${row.seat_cycle_id}\u0000${row.acquisition_batch}`); unique(committees, row => `${row.seat_cycle_id}\u0000${row.fec_candidate_id}\u0000${row.committee_id}\u0000${text(row.designation)}\u0000${text(row.effective_from)}`);
  if (profile.length !== 541 || unique(profile, row => row.seat_cycle_id).size !== 541 || profile.filter(row => row.occupancy_status === "occupied").length !== 537 || profile.filter(row => row.occupancy_status === "vacant").length !== 4 || terminal.size !== 541 || mapping.size !== 537 || vacancy.size !== 4 || coverage.length !== 2164) fail("LAUNCH_PROOF_COUNTS");
  for (const row of receipts) if (!approvedReceipt(row, true)) fail("LAUNCH_PROOF_MISSING");
  for (const row of deletions) if (!receipt.has(row.receipt_id) || !sha256.safeParse(row.attestation_sha256).success) fail("LAUNCH_PROOF_MISSING");
  if (deletion.size !== receipt.size || receipts.some(row => !deletion.has(row.id))) fail("LAUNCH_PROOF_MISSING");
  const approved = new Set(receipts.map(row => row.id)); const committeesBySeat = grouped(committees, row => row.seat_cycle_id); const pagesBySeat = grouped(pages, row => row.seat_cycle_id); const amendmentsBySeat = grouped(amendments, row => row.seat_cycle_id); const coverageBySeat = grouped(coverage, row => row.seat_cycle_id);
  const receiptsByBatch = grouped(receipts, row => text(row.acquisition_batch) ?? "");
  const terminalReceiptByBatch = new Map<string, Row>();
  for (const [batch, batchReceipts] of receiptsByBatch) {
    const ordered = [...batchReceipts].sort((left, right) => Number(left.page_number) - Number(right.page_number));
    if (!batch || ordered.some((row, index) => Number(row.page_number) !== index + 1) || ordered.filter(row => Number(row.terminal_page) === 1).length !== 1 || Number(ordered.at(-1)?.terminal_page) !== 1) fail("LAUNCH_PROOF_COUNTS");
    for (let index = 0; index < ordered.length - 1; index += 1) if (!exact(ordered[index]!.cursor_out, ordered[index + 1]!.cursor_in)) fail("LAUNCH_PROOF_COUNTS");
    terminalReceiptByBatch.set(batch, ordered.at(-1)!);
  }
  const filingsByChain = grouped(filings, chain);
  for (const row of [...mappings, ...committees, ...vacancies]) if (!approved.has(row.receipt_id)) fail("LAUNCH_PROOF_MISSING");
  for (const page of pages) if (!receipts.some(row => row.acquisition_batch === page.acquisition_batch)) fail("LAUNCH_PROOF_MISSING");
  for (const seat of profile) { const id = seat.seat_cycle_id; const result = terminal.get(id); const map = mapping.get(id); const vacant = vacancy.get(id); const committee = committeesBySeat.get(id) ?? []; const page = pagesBySeat.get(id) ?? []; const amend = amendmentsBySeat.get(id) ?? []; const closure = coverageBySeat.get(id) ?? [];
    if (!result || closure.length !== 4 || new Set(closure.map(row => row.kind)).size !== 4 || !closure.some(row => row.kind === "summary" && row.status === "complete") || closure.some(row => !["complete", "not_collected"].includes(row.status))) fail("LAUNCH_PROOF_COUNTS");
    const resolved = result!;
    if (!terminalOutcomes.includes(resolved.outcome as (typeof terminalOutcomes)[number])) fail("LAUNCH_PROOF_COUNTS");
    if (page.some(row => { const terminalReceipt = terminalReceiptByBatch.get(row.acquisition_batch); return !terminalReceipt || !exact(row.expected_terminal_page, row.actual_terminal_page) || !exact(row.expected_cursor_out, row.actual_cursor_out) || !exact(row.actual_terminal_page, terminalReceipt.page_number) || !exact(row.actual_cursor_out, terminalReceipt.cursor_out); })) fail("LAUNCH_PROOF_COUNTS");
    for (const attestation of amend) {
      const persisted = [...(filingsByChain.get(chain(attestation)) ?? [])].sort((left, right) => Number(left.amendment_number) - Number(right.amendment_number));
      if (!persisted.length || persisted.some((filing, index) => Number(filing.amendment_number) !== index || (index === 0 ? filing.amends_filing_id !== null : filing.amends_filing_id !== persisted[index - 1]!.id) || (index < persisted.length - 1 ? filing.amendment_status !== "superseded" : filing.amendment_status !== (index === 0 ? "new" : "amended")))) fail("LAUNCH_PROOF_COUNTS");
      const leaf = persisted.at(-1)!;
      if (!exact(attestation.expected_terminal_amendment, attestation.actual_terminal_amendment) || !exact(attestation.expected_filing_id, attestation.actual_filing_id) || !exact(attestation.actual_terminal_amendment, leaf.amendment_number) || !exact(attestation.actual_filing_id, leaf.id)) fail("LAUNCH_PROOF_COUNTS");
    }
    if (resolved.outcome === "vacancy") { if (seat.occupancy_status !== "vacant" || map || vacant === undefined || committee.length || page.length || amend.length) fail("LAUNCH_PROOF_COUNTS"); continue; }
    if (seat.occupancy_status !== "occupied" || !map || vacant) fail("LAUNCH_PROOF_COUNTS"); if (committee.some(row => row.fec_candidate_id !== map!.fec_candidate_id)) fail("LAUNCH_PROOF_COUNTS");
    const mapped = map!;
    if (resolved.outcome === "no_declared_cycle" && (mapped.outcome !== "no_declared_cycle" || committee.length || page.length || amend.length)) fail("LAUNCH_PROOF_COUNTS");
    if (resolved.outcome === "no_authorized_committee" && (mapped.outcome !== "mapped" || committee.length || page.length || amend.length)) fail("LAUNCH_PROOF_COUNTS");
    if (resolved.outcome === "no_report" && (mapped.outcome !== "mapped" || !committee.length || !page.length || amend.length)) fail("LAUNCH_PROOF_COUNTS");
    if (resolved.outcome === "approved_finance") {
      const seatChains = [...filingsByChain.entries()].filter(([, chainRows]) => chainRows[0]?.seat_cycle_id === id);
      if (mapped.outcome !== "mapped" || !committee.length || !page.length || !amend.length || amend.length !== seatChains.length || amend.some(row => !filingsByChain.has(chain(row)))) fail("LAUNCH_PROOF_COUNTS");
    }
  }
  requireSubjects(mappings, "fec_mapping"); requireSubjects(committees, "committee_mapping"); requireSubjects(pages, "finance_page_closure"); requireSubjects(amendments, "finance_amendment_closure"); requireSubjects(vacancies, "vacancy"); requireSubjects(terminals, "finance_terminal"); requireSubjects(coverage, "finance_closure");
  if (proof) { const derived = [...new Set(terminals.map(row => row.outcome))].sort(ascii); const supplied = [...proof.terminalOutcomes]; if (supplied.length !== new Set(supplied).size || supplied.join("\u0000") !== [...supplied].sort(ascii).join("\u0000") || supplied.join("\u0000") !== derived.join("\u0000")) fail("LAUNCH_PROOF_COUNTS"); }
}

export function validateElectionEvidence(evidence: ElectionEvidence): void {
  const { decisions, receipts, inventory, authority, envelopes, resultTotals, lineage, geometry } = evidence;
  const decision = unique(decisions, row => row.id); unique(inventory, row => row.id); const envelope = unique(envelopes, row => row.inventory_row_id); const authorityById = unique(authority, row => row.id); const geometryByContest = unique(geometry, row => row.contest_key); unique(resultTotals, row => `${row.envelope_id}\u0000${row.option_key}`); unique(lineage, row => `${row.envelope_id}\u0000${row.receipt_id}`);
  const year = (wanted: number): number => decisions.filter(row => Number(row.election_year) === wanted).length;
  if (decisions.length !== 158 || year(2020) !== 51 || year(2022) !== 56 || year(2024) !== 51 || decisions.some(row => row.status === "unassessed") || inventory.length !== envelopes.length || inventory.filter(row => Number(row.election_year) === 2020).length !== 51 || inventory.filter(row => Number(row.election_year) === 2024).length !== 51 || inventory.filter(row => Number(row.election_year) === 2022).length < 56) fail("LAUNCH_PROOF_COUNTS");
  const approved = new Set<string>(); for (const row of receipts) { if (!approvedReceipt(row, false)) fail("LAUNCH_PROOF_MISSING"); approved.add(row.id); }
  const totals = grouped(resultTotals, row => row.envelope_id); const links = grouped(lineage, row => row.envelope_id);
  const inventoryByDecision = grouped(inventory, row => row.decision_run_id);
  for (const row of decisions) { const entries = inventoryByDecision.get(row.id) ?? []; if (!entries.length || ((Number(row.election_year) === 2020 || Number(row.election_year) === 2024) && entries.length !== 1)) fail("LAUNCH_PROOF_COUNTS"); }
  for (const row of inventory) { if (!decision.has(row.decision_run_id) || !approved.has(row.inventory_receipt_id) || !envelope.has(row.id)) fail("LAUNCH_PROOF_MISSING"); if ((Number(row.election_year) === 2020 || Number(row.election_year) === 2024) && row.contest_kind !== "presidential_general") fail("LAUNCH_PROOF_COUNTS"); const geo = geometryByContest.get(row.contest_key); if (row.boundary_kind === "original" && geo && (Number(geo.required) !== 0 || geo.receipt_id !== null)) fail("LAUNCH_PROOF_COUNTS");
    const result = envelope.get(row.id)!; const artifact = authorityById.get(result.authority_artifact_id); if (!artifact || artifact.jurisdiction_code !== row.jurisdiction_code || Number(artifact.election_year) !== Number(row.election_year) || !artifact.receipt_id || !approved.has(artifact.receipt_id) || (result.certification_status !== null && result.certification_status !== artifact.certification_status)) fail("LAUNCH_PROOF_COUNTS"); const resultRows = totals.get(result.id) ?? []; const resultLinks = links.get(result.id) ?? [];
    const certifiedArtifact = artifact!;
    if (resultLinks.some(link => !approved.has(link.receipt_id))) fail("LAUNCH_PROOF_MISSING");
    if (result.disposition === "unavailable") {
      if (!text(result.first_failed_gate) || resultRows.length) fail("LAUNCH_PROOF_COUNTS");
    } else {
      if (
        result.disposition !== "approved"
        || text(result.first_failed_gate) !== undefined
        || text(result.reporting_completeness_percent) !== "100"
        || !["certified", "modeled", "reconciled"].includes(text(result.certification_status) ?? "")
        || !["accepted", "reconciled"].includes(text(result.reconciliation_status) ?? "")
        || !resultRows.length
        || !resultLinks.some(link => link.receipt_id === certifiedArtifact.receipt_id)
        || decimal(result.denominator_votes) !== resultRows.reduce((sum, item) => sum + decimal(item.votes), BigInt(0))
        || (text(result.allocation_method) !== "none" && text(result.allocation_coverage_percent) !== "100")
        || (row.boundary_kind === "modeled_current" && (!geo || Number(geo.required) !== 1 || !geo.receipt_id || !approved.has(geo.receipt_id)))
      ) fail("LAUNCH_PROOF_COUNTS");
    }
  }
  requireSubjects(inventory, "election_decision"); requireSubjects(envelopes, "election_result"); requireSubjects(geometry, "election_geometry");
}

// V1 signatures fail closed after any configured revocation, including signatures dated before it.
async function verifySignedReviewWithKey(review: SignedReview, key: ResolvedPublicKey | undefined, verifier: SignatureVerifier): Promise<void> { if (!signedReviewSchema.safeParse(review).success) fail("LAUNCH_PROOF_MALFORMED"); const at = new Date(review.signedAt); const role: ReviewerRole = review.subjectType === "publication" ? "release_approver" : "data_reviewer"; if (!key || key.reviewerRole !== role || key.revokedAt || at < key.validFrom || (key.validUntil && at > key.validUntil) || !key.allowedSubjectTypes.includes(review.subjectType) || !await verifier.verify(canonical({ reviewId: review.reviewId, subjectType: review.subjectType, subjectSha256: review.subjectSha256, reviewerId: review.reviewerId, signedAt: review.signedAt, keyId: review.keyId }), review.signature, key.publicKey)) fail("LAUNCH_PROOF_SIGNATURE"); }
// Keep V1's signed bytes and policy unchanged; resolve exactly once before delegating.
export async function verifySignedReview(review: SignedReview, resolver: PublicKeyResolver, verifier: SignatureVerifier): Promise<void> { if (!signedReviewSchema.safeParse(review).success) fail("LAUNCH_PROOF_MALFORMED"); await verifySignedReviewWithKey(review, await resolver.resolve(review.keyId, review.reviewerId), verifier); }

async function signatureIndex(client: PoolClient, releaseId: string): Promise<Map<string, SignatureRow>> {
  const result = await client.query<SignatureRow>(
    'SELECT review_id,subject_type,subject_sha256,reviewer_id,signed_at,signature,key_id FROM reviewer_signatures WHERE release_id=$1 ORDER BY review_id COLLATE "C"',
    [releaseId],
  );
  return unique(result.rows, row => row.review_id);
}

async function verifyEvidenceSignatures(
  evidence: FinanceEvidence | ElectionEvidence,
  signatures: Map<string, SignatureRow>,
  resolver: PublicKeyResolver,
  verifier: SignatureVerifier,
): Promise<void> {
  const groups: readonly [readonly (Row & ReviewFields)[], SubjectType][] = "profile" in evidence
    ? [[evidence.mappings, "fec_mapping"], [evidence.committees, "committee_mapping"], [evidence.pages, "finance_page_closure"], [evidence.amendments, "finance_amendment_closure"], [evidence.vacancies, "vacancy"], [evidence.terminals, "finance_terminal"], [evidence.coverage, "finance_closure"]]
    : [[evidence.inventory, "election_decision"], [evidence.envelopes, "election_result"], [evidence.geometry, "election_geometry"]];
  const checked = new Set<string>();
  for (const [evidenceRows, subjectType] of groups) {
    for (const evidenceRow of evidenceRows) {
      const signature = signatures.get(evidenceRow.review_id);
      if (!signature) fail("LAUNCH_PROOF_SIGNATURE");
      if (signature.subject_type !== subjectType || signature.subject_sha256 !== evidenceRow.subject_sha256) fail("LAUNCH_PROOF_SIGNATURE");
      if (checked.has(signature.review_id)) continue;
      checked.add(signature.review_id);
      const signedAt = signature.signed_at instanceof Date ? signature.signed_at.toISOString() : new Date(signature.signed_at).toISOString();
      await verifySignedReview({ reviewId: signature.review_id, subjectType: signature.subject_type, subjectSha256: signature.subject_sha256, reviewerId: signature.reviewer_id, signedAt, signature: signature.signature, keyId: signature.key_id }, resolver, verifier);
    }
  }
}

export async function verifyLaunchArtifacts(
  receipts: readonly Row[],
  finance: boolean,
  stores: LaunchArtifactStoreResolver,
): Promise<void> {
  for (const row of receipts) {
    if (!approvedReceipt(row, finance)) fail("LAUNCH_PROOF_MISSING");
    const storeKind = text(row.raw_store_kind);
    const storeIdentity = text(row.store_identity);
    const objectKey = text(row.object_key);
    const expectedSha256 = text(row[finance ? "response_sha256" : "sha256"]);
    const size = decimal(row.byte_size);
    if ((storeKind !== "local" && storeKind !== "s3") || !storeIdentity || !objectKey || !expectedSha256 || size > BigInt(Number.MAX_SAFE_INTEGER)) fail("LAUNCH_PROOF_MISSING");
    const reader = await stores.resolve(storeKind, storeIdentity);
    if (!reader) fail("LAUNCH_PROOF_MISSING");
    const byteSize = Number(size);
    const receipt: Parameters<LaunchArtifactReader["read"]>[0] = storeKind === "s3"
      ? { storeKind, storeLocator: storeIdentity, objectKey, sha256: expectedSha256, byteSize, versionId: text(row.version_id)!, etag: text(row.etag)! }
      : { storeKind, storeLocator: storeIdentity, objectKey, sha256: expectedSha256, byteSize };
    const bytes = await reader.read(receipt);
    if (bytes.byteLength !== byteSize || createHash("sha256").update(bytes).digest("hex") !== expectedSha256) fail("LAUNCH_PROOF_HASH");
  }
}

async function verifyStoredPublicationProof(
  client: PoolClient,
  table: "finance_publication_proofs" | "election_publication_proofs",
  releaseId: string,
  proofId: string,
  canonicalSha: string,
  resolver: PublicKeyResolver,
  verifier: SignatureVerifier,
): Promise<void> {
  const result = await client.query<SignatureRow & { canonical_sha256: string }>(
    `SELECT p.canonical_sha256,s.review_id,s.subject_type,s.subject_sha256,s.reviewer_id,s.signed_at,s.signature,s.key_id FROM ${table} p JOIN reviewer_signatures s ON (s.release_id,s.review_id)=(p.release_id,p.signed_review_id) WHERE p.release_id=$1 AND p.id=$2`,
    [releaseId, proofId],
  );
  if (result.rowCount !== 1 || !result.rows[0]) fail("LAUNCH_PROOF_MISSING");
  const row = result.rows[0];
  if (row.canonical_sha256 !== canonicalSha || row.subject_type !== "publication" || row.subject_sha256 !== canonicalSha) fail("LAUNCH_PROOF_HASH");
  const signedAt = row.signed_at instanceof Date ? row.signed_at.toISOString() : new Date(row.signed_at).toISOString();
  await verifySignedReview({ reviewId: row.review_id, subjectType: row.subject_type, subjectSha256: row.subject_sha256, reviewerId: row.reviewer_id, signedAt, signature: row.signature, keyId: row.key_id }, resolver, verifier);
}

async function rows(client: PoolClient, sql: string, releaseId: string): Promise<Row[]> { return (await client.query<Row>(sql, [releaseId])).rows; }
const select = (table: string, order: string): string => `SELECT * FROM ${table} WHERE release_id=$1 ORDER BY ${order}`;
async function assertRelease(client: PoolClient, id: string): Promise<void> { const result = await client.query<{ source_cutoff: Date | string }>("SELECT source_cutoff FROM data_releases WHERE id=$1", [id]); if (result.rowCount !== 1) fail("LAUNCH_PROOF_RELEASE"); if (!result.rows[0] || sourceCutoff(result.rows[0].source_cutoff) !== "2026-07-18") fail("LAUNCH_PROOF_CUTOFF"); }
async function loadDigests(client: PoolClient, id: string): Promise<DigestRow[]> { const digests = await rows(client, 'SELECT domain,row_count,sha256 FROM release_content_digests WHERE release_id=$1 ORDER BY domain COLLATE "C"', id) as DigestRow[]; if (digests.length !== 7 || digests.some(row => !sha256.safeParse(row.sha256).success) || digests.map(row => row.domain).join("|") !== digestDomains.join("|")) fail("LAUNCH_PROOF_DIGESTS"); return digests; }

const v2Columns: Readonly<Record<string, string>> = Object.freeze({
  targets: "plan_sha256,seat_cycle_id,kind,disposition,evidence_sha256", artifacts: "plan_sha256,artifact_sha256,artifact_kind,canonical_byte_size,created_at", enumerationPages: "plan_sha256,artifact_sha256,artifact_kind,pass,form_type,receipt_date,requested_file_number,page_number,terminal", filingLedgers: "plan_sha256,artifact_sha256,artifact_kind,stable,finalized_at", filingLedgerEntries: "plan_sha256,ledger_sha256,file_number,entry_identity_sha256,canonical_form_type,base_form_type,report_type,report_date,receipt_date,coverage_start,coverage_end,amendment_indicator,filer_id,committee_id,electronic_status,raw_source_availability", pageLineage: "plan_sha256,ledger_sha256,file_number,page_sha256,pass,occurrence_index", amendmentLinks: "plan_sha256,ledger_sha256,file_number,predecessor_file_number", sanitizedFilings: "plan_sha256,artifact_sha256,artifact_kind,file_number,ledger_sha256,report_date", alternateScoping: "plan_sha256,file_number,sanitized_artifact_sha256,ledger_sha256,conclusion", mappings: "id,plan_sha256,seat_cycle_id,target_kind,outcome,fec_candidate_id,candidacy_id,candidacy_contest_id,evidence_sha256", committees: "id,plan_sha256,candidate_mapping_id,committee_id,designation,evidence_sha256", elections: "id,plan_sha256,seat_cycle_id,outcome,candidate_mapping_id,contest_id,election_code,election_date,evidence_sha256", closures: "id,plan_sha256,seat_cycle_id,target_kind,subject_kind,subject_identity,candidate_mapping_id,status,finalized_at,subject_sha256", closureReceipts: "plan_sha256,closure_id,receipt_id", closureSnapshots: "plan_sha256,closure_id,snapshot_id", coverage: "plan_sha256,seat_cycle_id,closure_id,subject_identity,outcome,support_cents,oppose_cents", aggregates: "plan_sha256,seat_cycle_id,candidate_mapping_id,election_mapping_id,closure_id,support_cents,oppose_cents,methodology,coverage_through", dataSignatures: "review_id,plan_sha256,origin_release_id,subject_type,subject_sha256,reviewer_id,key_id,public_key_fingerprint,signed_at,signature",
});
const v2Table: Readonly<Record<keyof typeof v2Columns, string>> = Object.freeze({ targets: "fec_v2_plan_targets", artifacts: "fec_v2_artifacts", enumerationPages: "fec_v2_enumeration_pages", filingLedgers: "fec_v2_filing_ledgers", filingLedgerEntries: "fec_v2_filing_ledger_entries", pageLineage: "fec_v2_page_lineage", amendmentLinks: "fec_v2_amendment_chain_links", sanitizedFilings: "fec_v2_sanitized_filings", alternateScoping: "fec_v2_alternate_scoping", mappings: "fec_v2_candidate_mappings", committees: "fec_v2_committee_mappings", elections: "fec_v2_election_mappings", closures: "fec_v2_finance_closures", closureReceipts: "fec_v2_closure_input_receipts", closureSnapshots: "fec_v2_closure_input_snapshots", coverage: "fec_v2_seat_coverage", aggregates: "fec_v2_exact_election_aggregates", dataSignatures: "fec_v2_data_review_signatures" });
/** Full natural keys, deliberately never collating numeric/date columns. */
export const fecV2NaturalOrder: Readonly<Record<keyof typeof v2Columns, string>> = Object.freeze({
  targets: 'seat_cycle_id COLLATE "C"', artifacts: 'artifact_sha256 COLLATE "C"', enumerationPages: 'artifact_sha256 COLLATE "C"',
  filingLedgers: 'artifact_sha256 COLLATE "C"', filingLedgerEntries: 'ledger_sha256 COLLATE "C",entry_identity_sha256 COLLATE "C",file_number',
  pageLineage: 'ledger_sha256 COLLATE "C",file_number,page_sha256 COLLATE "C",pass,occurrence_index', amendmentLinks: 'ledger_sha256 COLLATE "C",file_number,predecessor_file_number',
  sanitizedFilings: 'artifact_sha256 COLLATE "C"', alternateScoping: 'file_number,sanitized_artifact_sha256 COLLATE "C"',
  mappings: 'id COLLATE "C"', committees: 'id COLLATE "C"', elections: 'id COLLATE "C"', closures: 'id COLLATE "C"',
  closureReceipts: 'closure_id COLLATE "C",receipt_id COLLATE "C"', closureSnapshots: 'closure_id COLLATE "C",snapshot_id COLLATE "C"',
  coverage: 'seat_cycle_id COLLATE "C"', aggregates: 'seat_cycle_id COLLATE "C",candidate_mapping_id COLLATE "C",election_mapping_id COLLATE "C"', dataSignatures: 'review_id COLLATE "C"',
});
const dateIso = (value: unknown): string => { const date = new Date(String(value)); if (Number.isNaN(date.valueOf())) fail("LAUNCH_PROOF_MALFORMED"); return date.toISOString(); };
const transcriptCommon = { receiptId: z.string().min(1), objectKey: z.string().min(1), versionId: z.string().min(1), etag: z.string().min(1), artifactSha256: sha256, byteSize: z.string().regex(/^\d+$/), upstreamEntitySha256: sha256.nullable(), retrievedAt: z.string().datetime({ offset: true }), snapshotId: z.string().min(1), planSha256: sha256, replaySha256: sha256, replayByteSize: z.string().regex(/^\d+$/), canonicalDecodeVersion: z.literal("1") };
const transcriptSchema = z.discriminatedUnion("artifactKind", [
  z.object({ ...transcriptCommon, artifactKind: z.literal("enumeration_page"), replayArtifactKind: z.literal("enumeration_page"), canonicalSchema: z.literal("fec-v2-enumeration-page-v1"), decoded: z.object({ kind: z.literal("enumeration_page"), schema: z.literal("fec-v2-enumeration-page-v1"), version: z.literal(1), planSha256: sha256, provenance: z.unknown(), pass: z.union([z.literal(1), z.literal(2)]), pageNumber: z.number().int(), terminal: z.boolean(), records: z.array(z.object({ occurrenceIndex: z.number().int(), identity: z.unknown(), entryIdentitySha256: sha256 }).strict()), recordMultiplicity: z.array(z.object({ entryIdentitySha256: sha256, count: z.number().int() }).strict()) }).strict() }).strict(),
  z.object({ ...transcriptCommon, artifactKind: z.literal("filing_ledger"), replayArtifactKind: z.literal("filing_ledger"), canonicalSchema: z.literal("fec-v2-filing-ledger-v1"), decoded: z.object({ kind: z.literal("filing_ledger"), schema: z.literal("fec-v2-filing-ledger-v1"), version: z.literal(1), planSha256: sha256, entries: z.array(z.object({ identity: z.unknown(), entryIdentitySha256: sha256 }).strict()), sourcePageIdentities: z.array(sha256), pass1DigestSha256: sha256, pass2DigestSha256: sha256, stable: z.literal(true) }).strict() }).strict(),
  z.object({ ...transcriptCommon, artifactKind: z.literal("sanitized_filing"), replayArtifactKind: z.literal("sanitized_filing"), canonicalSchema: z.literal(FEC_SANITIZED_FILING_SCHEMA), decoded: z.object({ kind: z.literal("sanitized_filing"), fileNumber: z.number().int().safe().positive(), ledgerIdentitySha256: sha256, reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), candidateIds: z.array(z.string().refine(isFecCandidateId)), scopeConclusion: z.enum(["inside_candidate_targets", "outside_candidate_targets"]), semanticSha256: sha256 }).strict() }).strict(),
]);
const transcriptDescriptor = (row: FecV2ArtifactTranscript): FecV2ArtifactDescriptor => ({ receiptId: row.receiptId, objectKey: row.objectKey, versionId: row.versionId, etag: row.etag, artifactSha256: row.artifactSha256, byteSize: row.byteSize, artifactKind: row.artifactKind, upstreamEntitySha256: row.upstreamEntitySha256, retrievedAt: row.retrievedAt, snapshotId: row.snapshotId, planSha256: row.planSha256 });
export function validateFecV2ArtifactTranscript(value: unknown, descriptorValue: FecV2ArtifactDescriptor): value is FecV2ArtifactTranscript {
  const parsed = transcriptSchema.safeParse(value); if (!parsed.success) return false;
  const row = parsed.data as FecV2ArtifactTranscript;
  if (canonical(transcriptDescriptor(row)) !== canonical(descriptorValue) || row.replaySha256 !== descriptorValue.artifactSha256 || row.replayByteSize !== descriptorValue.byteSize || row.replayArtifactKind !== descriptorValue.artifactKind) return false;
  try {
    if (row.artifactKind === "enumeration_page") {
      const decoded = row.decoded;
      const page = { schema: decoded.schema, version: decoded.version, planSha256: decoded.planSha256, provenance: decoded.provenance, pass: decoded.pass, pageNumber: decoded.pageNumber, terminal: decoded.terminal, records: decoded.records.map(record => ({ occurrenceIndex: record.occurrenceIndex, identity: record.identity })), recordMultiplicity: decoded.recordMultiplicity };
      if (decoded.planSha256 !== row.planSha256 || decoded.records.some(record => fecFilingIdentitySha256(record.identity) !== record.entryIdentitySha256)) return false;
      encodeFecEnumerationPage(page); // strict decoder/encoder validates provenance, occurrence order, multiplicity, terminal rule, and canaries.
    } else if (row.artifactKind === "filing_ledger") {
      const decoded = row.decoded;
      if (decoded.planSha256 !== row.planSha256 || decoded.entries.some(entry => fecFilingIdentitySha256(entry.identity) !== entry.entryIdentitySha256)) return false;
      const { kind, ...ledger } = decoded; void kind;
      encodeFecFilingLedger({ ...ledger, entries: decoded.entries.map(entry => ({ identity: entry.identity, entryIdentitySha256: entry.entryIdentitySha256 })) });
    } else {
      const decoded = row.decoded;
      if (!decoded.candidateIds.every((id, i, ids) => i === 0 || ascii(ids[i - 1]!, id) < 0) || decoded.semanticSha256 !== canonicalSha256({ fileNumber: decoded.fileNumber, ledgerIdentitySha256: decoded.ledgerIdentitySha256, reportDate: decoded.reportDate, candidateIds: decoded.candidateIds, scopeConclusion: decoded.scopeConclusion })) return false;
    }
    return true;
  } catch { return false; }
}
/** Builds strict replay evidence from canonical enumeration/ledger bytes. Sanitized decoding awaits its dedicated codec. */
export function buildFecV2ArtifactTranscriptFromCanonicalBytes(descriptor: FecV2ArtifactDescriptor, bytes: Uint8Array, options?: FecV2ArtifactBuildOptions): FecV2ArtifactTranscript {
  if (!sha256.safeParse(descriptor.artifactSha256).success || !/^\d+$/.test(descriptor.byteSize) || BigInt(descriptor.byteSize) !== BigInt(bytes.byteLength) || createHash("sha256").update(bytes).digest("hex") !== descriptor.artifactSha256) throw new Error("FEC_V2_ARTIFACT_IDENTITY");
  const common = { ...descriptor, replaySha256: descriptor.artifactSha256, replayByteSize: descriptor.byteSize, canonicalDecodeVersion: "1" as const };
  if (descriptor.artifactKind === "enumeration_page") { const page = decodeFecEnumerationPage(bytes, options); const transcript: FecV2ArtifactTranscript = { ...common, artifactKind: "enumeration_page", replayArtifactKind: "enumeration_page", canonicalSchema: "fec-v2-enumeration-page-v1", decoded: { kind: "enumeration_page", ...page, records: page.records.map(record => ({ ...record, entryIdentitySha256: fecFilingIdentitySha256(record.identity, options) })) } }; if (!validateFecV2ArtifactTranscript(transcript, descriptor)) throw new Error("FEC_V2_ARTIFACT_INVALID"); return transcript; }
  if (descriptor.artifactKind === "filing_ledger") { const ledger = decodeFecFilingLedger(bytes, options); const transcript: FecV2ArtifactTranscript = { ...common, artifactKind: "filing_ledger", replayArtifactKind: "filing_ledger", canonicalSchema: "fec-v2-filing-ledger-v1", decoded: { kind: "filing_ledger", ...ledger } }; if (!validateFecV2ArtifactTranscript(transcript, descriptor)) throw new Error("FEC_V2_ARTIFACT_INVALID"); return transcript; }
  const targetCandidateIds = options?.targetCandidateIds;
  if (!targetCandidateIds || targetCandidateIds.some((id, index) => !isFecCandidateId(id) || index > 0 && Buffer.compare(Buffer.from(targetCandidateIds[index - 1]!), Buffer.from(id)) >= 0)) throw new Error("FEC_V2_SANITIZED_TARGETS_INVALID");
  const sanitizerContext = { signal: options?.signal ?? new AbortController().signal, deadlineMs: options?.deadlineMs ?? Number.MAX_SAFE_INTEGER };
  const filing = decodeFecSanitizedFilingArtifact(bytes, sanitizerContext);
  if (filing.acquisitionPlanSha256 !== descriptor.planSha256 || !Buffer.from(bytes).equals(encodeFecSanitizedFilingArtifact(filing, sanitizerContext))) throw new Error("FEC_V2_ARTIFACT_INVALID");
  const candidateIds = [...new Set(filing.records.map(record => record.candidateId))].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  const targets = new Set(targetCandidateIds);
  const scopeConclusion: FecV2SanitizedDecoded["scopeConclusion"] = candidateIds.some(id => targets.has(id)) ? "inside_candidate_targets" : "outside_candidate_targets";
  const decoded = { kind: "sanitized_filing" as const, fileNumber: filing.fileNumber, ledgerIdentitySha256: filing.ledgerIdentitySha256, reportDate: filing.reportDate, candidateIds, scopeConclusion, semanticSha256: canonicalSha256({ fileNumber: filing.fileNumber, ledgerIdentitySha256: filing.ledgerIdentitySha256, reportDate: filing.reportDate, candidateIds, scopeConclusion }) };
  const transcript: FecV2ArtifactTranscript = { ...common, artifactKind: "sanitized_filing", replayArtifactKind: "sanitized_filing", canonicalSchema: FEC_SANITIZED_FILING_SCHEMA, decoded };
  if (!validateFecV2ArtifactTranscript(transcript, descriptor)) throw new Error("FEC_V2_ARTIFACT_INVALID"); return transcript;
}
/** Validates the loaded V2 publication graph; release/plan hashes are checked by the caller. */
export function validateFecV2PublicationGraph(payload: FecV2CanonicalPayload): void {
  try {
    const key = (...values: unknown[]): string => values.map(value => value === null || value === undefined ? "<null>" : String(value)).join("\u0000");
    const rows = (input: readonly FecV2GraphRow[], name: string): Map<string, FecV2GraphRow> => unique(input, row => key(row[name]));
    const plan = String(payload.proof.planSha256);
    const target = rows(payload.targets, "seat_cycle_id");
    if (target.size !== 541 || [...target.values()].some(row => String(row.plan_sha256) !== plan || !["terminal", "candidate_resolution_required"].includes(String(row.kind)))) fail("LAUNCH_PROOF_COUNTS");
    const closures = rows(payload.closures, "id"); const coverage = rows(payload.coverage, "seat_cycle_id");
    if (closures.size !== 541 || coverage.size !== 541 || [...target.keys()].some(id => !closuresHasSeat(closures, id) || !coverage.has(id))) fail("LAUNCH_PROOF_COUNTS");
    function closuresHasSeat(index: Map<string, FecV2GraphRow>, seat: string): boolean { return [...index.values()].filter(row => String(row.seat_cycle_id) === seat).length === 1; }
    const closureBySeat = new Map<string, FecV2GraphRow>(); for (const closure of closures.values()) { const seat = String(closure.seat_cycle_id); if (!target.has(seat) || closureBySeat.has(seat) || String(closure.plan_sha256) !== plan || !closure.finalized_at || String(closure.status) !== "finalized" || ["global_block", "unscoped", "unavailable", "missing"].includes(String(closure.subject_kind))) fail("LAUNCH_PROOF_COUNTS"); closureBySeat.set(seat, closure); }
    const mapping = rows(payload.mappings, "id"); const election = rows(payload.elections, "id");
    const aggregateBySeat = grouped(payload.aggregates, row => String(row.seat_cycle_id));
    for (const [seat, item] of target) {
      const close = closureBySeat.get(seat); const cover = coverage.get(seat);
      if (!close || !cover || String(cover.plan_sha256) !== plan || String(cover.closure_id) !== String(close.id) || String(cover.subject_identity) !== String(close.subject_identity) || !["complete_zero", "complete_nonzero"].includes(String(cover.outcome))) fail("LAUNCH_PROOF_COUNTS");
      const support = decimal(cover.support_cents), oppose = decimal(cover.oppose_cents);
      if ((cover.outcome === "complete_zero") !== (support === BigInt(0) && oppose === BigInt(0))) fail("LAUNCH_PROOF_COUNTS");
      if (cover.outcome === "complete_nonzero" && support === BigInt(0) && oppose === BigInt(0)) fail("LAUNCH_PROOF_COUNTS");
      const aggs = aggregateBySeat.get(seat) ?? [];
      if (String(item.kind) === "terminal") {
        if (String(close.target_kind) !== "terminal" || close.candidate_mapping_id !== null || String(close.subject_kind) !== "terminal" || String(close.subject_identity) !== "terminal" || support !== BigInt(0) || oppose !== BigInt(0) || aggs.length || [...mapping.values()].some(row => String(row.seat_cycle_id) === seat) || [...election.values()].some(row => String(row.seat_cycle_id) === seat)) fail("LAUNCH_PROOF_COUNTS");
        continue;
      }
      const mapped = [...mapping.values()].filter(row => String(row.seat_cycle_id) === seat && String(row.target_kind) === String(item.kind));
      if (String(close.target_kind) !== "candidate_resolution_required" || String(close.subject_kind) !== "candidate" || mapped.length !== 1 || !mapped[0]!.fec_candidate_id || String(mapped[0]!.plan_sha256) !== plan || String(close.candidate_mapping_id) !== String(mapped[0]!.id) || String(close.subject_identity) !== String(mapped[0]!.id)) fail("LAUNCH_PROOF_COUNTS");
      const elections = [...election.values()].filter(row => String(row.candidate_mapping_id) === String(mapped[0]!.id) && String(row.seat_cycle_id) === seat);
      if (elections.length !== 1 || !elections[0]!.contest_id || !elections[0]!.election_code || !elections[0]!.election_date || String(elections[0]!.plan_sha256) !== plan) fail("LAUNCH_PROOF_COUNTS");
      if (aggs.length !== 1) fail("LAUNCH_PROOF_COUNTS"); const aggregate = aggs[0]!;
      if (String(aggregate.candidate_mapping_id) !== String(mapped[0]!.id) || String(aggregate.election_mapping_id) !== String(elections[0]!.id) || String(aggregate.closure_id) !== String(close.id) || String(aggregate.methodology) !== "fec-receipt-cutoff-v2" || sourceCutoff(String(aggregate.coverage_through)) !== "2026-07-18" || decimal(aggregate.support_cents) !== support || decimal(aggregate.oppose_cents) !== oppose) fail("LAUNCH_PROOF_COUNTS");
    }
    if ([...mapping.values()].some(row => !target.has(String(row.seat_cycle_id))) || [...election.values()].some(row => !mapping.has(String(row.candidate_mapping_id)))) fail("LAUNCH_PROOF_MISSING");
    const mappedIds = new Set([...mapping.values()].filter(row => String(target.get(String(row.seat_cycle_id))?.kind) === "candidate_resolution_required").map(row => String(row.id))); if (payload.committees.some(row => !mappedIds.has(String(row.candidate_mapping_id)))) fail("LAUNCH_PROOF_MISSING");
    const receipt = new Map(payload.receipts.map(row => [row.receiptId, row])); if (receipt.size !== payload.receipts.length) fail("LAUNCH_PROOF_COUNTS");
    const snapshots = rows(payload.sourceSnapshots, "snapshot_id"); const artifacts = rows(payload.artifacts, "artifact_sha256");
    const receiptJoin = unique(payload.closureReceipts, row => key(row.closure_id, row.receipt_id)); const snapshotJoin = unique(payload.closureSnapshots, row => key(row.closure_id, row.snapshot_id));
    const joinReceipts = grouped(payload.closureReceipts, row => String(row.closure_id)); const joinSnapshots = grouped(payload.closureSnapshots, row => String(row.closure_id));
    for (const closure of closures.values()) { const rs = joinReceipts.get(String(closure.id)) ?? [], ss = joinSnapshots.get(String(closure.id)) ?? []; if (!rs.length || !ss.length || rs.some(row => !receipt.has(String(row.receipt_id))) || ss.some(row => !snapshots.has(String(row.snapshot_id))) || rs.some(row => !ss.some(snapshot => String(snapshot.snapshot_id) === receipt.get(String(row.receipt_id))!.snapshotId))) fail("LAUNCH_PROOF_MISSING"); }
    if ([...receiptJoin.values()].some(row => !closures.has(String(row.closure_id)) || !receipt.has(String(row.receipt_id))) || [...snapshotJoin.values()].some(row => !closures.has(String(row.closure_id)) || !snapshots.has(String(row.snapshot_id)))) fail("LAUNCH_PROOF_MISSING");
    const receiptsBySnapshot = grouped(payload.receipts, row => row.snapshotId);
    for (const snapshot of snapshots.values()) { const members = receiptsBySnapshot.get(String(snapshot.snapshot_id)) ?? []; if (String(snapshot.usage_status) !== "approved" || !snapshot.sealed_at || !members.length || fecV2ReceiptSetDigestSha256(plan, String(snapshot.snapshot_id), members.map(row => ({ receiptId: row.receiptId, artifactKind: row.artifactKind, artifactSha256: row.artifactSha256, upstreamEntitySha256: row.upstreamEntitySha256, objectKey: row.objectKey, versionId: row.versionId, etag: row.etag, byteSize: BigInt(row.byteSize), retrievedAt: new Date(row.retrievedAt) }))) !== snapshot.receipt_set_digest_sha256 || snapshot.checksum_sha256 !== snapshot.receipt_set_digest_sha256) fail("LAUNCH_PROOF_HASH"); }
    for (const item of payload.receipts) { const parent = artifacts.get(item.artifactSha256); if (!snapshots.has(item.snapshotId) || !parent || String(parent.artifact_kind) !== item.artifactKind || decimal(parent.canonical_byte_size) !== decimal(item.byteSize)) fail("LAUNCH_PROOF_ARTIFACT"); }
    if ([...artifacts.keys()].some(id => !payload.receipts.some(row => row.artifactSha256 === id))) fail("LAUNCH_PROOF_ARTIFACT");
    const subtype = (items: readonly FecV2GraphRow[], kind: string): void => { unique(items, row => String(row.artifact_sha256)); for (const row of items) { const parent = artifacts.get(String(row.artifact_sha256)); if (!parent || String(parent.artifact_kind) !== kind || String(row.artifact_kind) !== kind) fail("LAUNCH_PROOF_ARTIFACT"); } };
    subtype(payload.enumerationPages, "enumeration_page"); subtype(payload.filingLedgers, "filing_ledger"); subtype(payload.sanitizedFilings, "sanitized_filing");
    for (const parent of artifacts.values()) { const id = String(parent.artifact_sha256), kind = String(parent.artifact_kind); const count = (kind === "enumeration_page" ? payload.enumerationPages : kind === "filing_ledger" ? payload.filingLedgers : kind === "sanitized_filing" ? payload.sanitizedFilings : []).filter(row => String(row.artifact_sha256) === id).length; if (count !== 1) fail("LAUNCH_PROOF_ARTIFACT"); }
    const ledger = rows(payload.filingLedgers, "artifact_sha256"); if (ledger.size !== 1 || [...ledger.values()].some(row => row.stable !== 1 || !row.finalized_at) || payload.receipts.filter(row => row.artifactKind === "filing_ledger").length !== 1) fail("LAUNCH_PROOF_COUNTS");
    const primaryDates = new Set<string>();
    for (let day = Date.UTC(2025, 0, 1); day <= Date.UTC(2026, 6, 18); day += 86_400_000) primaryDates.add(new Date(day).toISOString().slice(0, 10));
    const primary = new Map<string, FecV2GraphRow[]>(); const predecessorPages = new Map<string, FecV2GraphRow[]>();
    for (const page of payload.enumerationPages) {
      const pass = Number(page.pass), form = String(page.form_type), receiptDate = page.receipt_date, requested = page.requested_file_number;
      if (![1, 2].includes(pass) || !["F24", "F3", "F3X", "F5"].includes(form) || typeof page.terminal !== "number" || ![0, 1].includes(page.terminal) || typeof page.page_number !== "number" || !Number.isInteger(page.page_number) || page.page_number < 1 || (receiptDate === null) === (requested === null)) fail("LAUNCH_PROOF_COUNTS");
      const bucket = receiptDate === null ? predecessorPages : primary;
      const bucketKey = receiptDate === null ? key(form, requested) : key(form, sourceCutoff(String(receiptDate)), pass);
      bucket.set(bucketKey, [...(bucket.get(bucketKey) ?? []), page]);
    }
    if (primary.size !== 4 * 2 * primaryDates.size || [...primary.keys()].some(index => { const [form, date, pass] = index.split("\u0000"); return !["F24", "F3", "F3X", "F5"].includes(form!) || !primaryDates.has(date!) || !["1", "2"].includes(pass!); })) fail("LAUNCH_PROOF_COUNTS");
    const closedPages = (items: readonly FecV2GraphRow[]): boolean => { const ordered = [...items].sort((a, b) => Number(a.page_number) - Number(b.page_number)); return ordered.every((page, index) => Number(page.page_number) === index + 1 && Number(page.terminal) === (index === ordered.length - 1 ? 1 : 0)); };
    if ([...primary.values()].some(items => !closedPages(items))) fail("LAUNCH_PROOF_COUNTS");
    const entries = unique(payload.filingLedgerEntries, row => key(row.ledger_sha256, row.file_number));
    for (const entry of entries.values()) if (!ledger.has(String(entry.ledger_sha256))) fail("LAUNCH_PROOF_MISSING");
    const predecessor = new Map<string, string>(); const successors = new Map<string, string>(); unique(payload.amendmentLinks, row => key(row.ledger_sha256, row.file_number));
    for (const row of payload.amendmentLinks) { const current = key(row.ledger_sha256, row.file_number), previous = row.predecessor_file_number === null ? undefined : key(row.ledger_sha256, row.predecessor_file_number); if (!entries.has(current) || (previous && (!entries.has(previous) || previous === current)) || (previous && successors.has(previous))) fail("LAUNCH_PROOF_COUNTS"); if (previous) { predecessor.set(current, previous); successors.set(previous, current); } }
    for (const start of predecessor.keys()) { const seen = new Set<string>(); for (let at: string | undefined = start; at; at = predecessor.get(at)) { if (seen.has(at)) fail("LAUNCH_PROOF_COUNTS"); seen.add(at); } }
    const requiredLookups = new Set<string>();
    for (const previous of predecessor.values()) { const entry = entries.get(previous)!; if (sourceCutoff(String(entry.receipt_date))! < "2025-01-01") requiredLookups.add(key(entry.canonical_form_type, entry.file_number)); }
    for (const entry of entries.values()) if (sourceCutoff(String(entry.receipt_date))! < "2025-01-01" && ![...predecessor.values()].includes(key(entry.ledger_sha256, entry.file_number))) fail("LAUNCH_PROOF_COUNTS");
    if (predecessorPages.size !== requiredLookups.size || [...predecessorPages.keys()].some(identity => !requiredLookups.has(identity))) fail("LAUNCH_PROOF_COUNTS");
    for (const [identity, items] of predecessorPages) { const passes = grouped(items, page => String(page.pass)); if (!requiredLookups.has(identity) || passes.size !== 2 || !passes.has("1") || !passes.has("2") || [...passes.values()].some(group => !closedPages(group))) fail("LAUNCH_PROOF_COUNTS"); }
    // Occurrence/page closure is replay-derived: a DB-only graph cannot prove it.
    if (payload.pageLineage.some(row => !entries.has(key(row.ledger_sha256, row.file_number)) || !payload.enumerationPages.some(page => String(page.artifact_sha256) === String(row.page_sha256)) || !artifacts.has(String(row.page_sha256)))) fail("LAUNCH_PROOF_MISSING");
    unique(payload.sanitizedFilings, row => String(row.artifact_sha256)); unique(payload.alternateScoping, row => key(row.ledger_sha256, row.file_number, row.sanitized_artifact_sha256)); const sanitized = new Map(payload.sanitizedFilings.map(row => [String(row.artifact_sha256), row]));
    for (const row of sanitized.values()) if (!entries.has(key(row.ledger_sha256, row.file_number))) fail("LAUNCH_PROOF_MISSING");
    const referencedSanitized = new Set<string>(); for (const row of payload.alternateScoping) { const filing = sanitized.get(String(row.sanitized_artifact_sha256)); if (!filing || String(row.conclusion) !== "outside_candidate_targets" || !exact(row.ledger_sha256, filing.ledger_sha256) || !exact(row.file_number, filing.file_number)) fail("LAUNCH_PROOF_COUNTS"); referencedSanitized.add(String(row.sanitized_artifact_sha256)); }
  } catch (error) { if (error instanceof LaunchProofError) throw error; fail("LAUNCH_PROOF_MALFORMED"); }
}
/** Validates decoded sanitized artifacts against their ledger and mapped candidate scope. */
export function validateFecV2ArtifactSemantics(payload: FecV2CanonicalPayload, transcript: readonly FecV2ArtifactTranscript[]): void {
  /* This is intentionally a replay, not a plausibility check over DB rows. */
  const receiptById = unique(payload.receipts, item => item.receiptId);
  if (transcript.length !== payload.receipts.length || new Set(transcript.map(item => item.receiptId)).size !== transcript.length) fail("LAUNCH_PROOF_ARTIFACT");
  for (const item of transcript) { const receipt = receiptById.get(item.receiptId); if (!receipt || !validateFecV2ArtifactTranscript(item, receipt) || (item.artifactKind === "filing_ledger" ? item.upstreamEntitySha256 !== null : !sha256.safeParse(item.upstreamEntitySha256).success)) fail("LAUNCH_PROOF_ARTIFACT"); }
  const byArtifact = unique(transcript, item => item.artifactSha256);
  const ledgerReplays = transcript.filter((item): item is Extract<FecV2ArtifactTranscript, { artifactKind: "filing_ledger" }> => item.artifactKind === "filing_ledger");
  if (ledgerReplays.length !== 1 || payload.filingLedgers.length !== 1 || payload.receipts.filter(item => item.artifactKind === "filing_ledger").length !== 1 || ledgerReplays[0]!.artifactSha256 !== String(payload.filingLedgers[0]!.artifact_sha256) || ledgerReplays[0]!.planSha256 !== String(payload.proof.planSha256) || String(payload.filingLedgers[0]!.plan_sha256) !== String(payload.proof.planSha256)) fail("LAUNCH_PROOF_ARTIFACT");
  const ledgerReplay = ledgerReplays[0]!;
  // Predecessor/corroboration is authenticated by replayed identity chains and exact amendment links, not a nonexistent DB field.
  const dbField: Record<string, keyof FecFilingIdentityV1> = { canonical_form_type: "canonicalFormType", base_form_type: "baseFormType", report_type: "reportType", report_date: "reportDate", receipt_date: "receiptDate", coverage_start: "coverageStartDate", coverage_end: "coverageEndDate", amendment_indicator: "amendmentIndicator", filer_id: "filerId", committee_id: "committeeId", electronic_status: "electronicStatus", raw_source_availability: "rawAvailability" };
  const dbEntries = payload.filingLedgerEntries.filter(row => String(row.ledger_sha256) === ledgerReplay.artifactSha256);
  if (dbEntries.length !== payload.filingLedgerEntries.length || dbEntries.length !== ledgerReplay.decoded.entries.length) fail("LAUNCH_PROOF_ARTIFACT");
  const dbByHash = unique(dbEntries, row => String(row.entry_identity_sha256));
  for (const entry of ledgerReplay.decoded.entries) {
    const db = dbByHash.get(entry.entryIdentitySha256);
    if (!db || fecFilingIdentitySha256(entry.identity) !== entry.entryIdentitySha256 || String(db.file_number) !== String(entry.identity.fileNumber)
      || Object.entries(dbField).some(([field, identityField]) => !exact(db[field], entry.identity[identityField]))) fail("LAUNCH_PROOF_ARTIFACT");
  }
  const pages = transcript.filter((item): item is Extract<FecV2ArtifactTranscript, { artifactKind: "enumeration_page" }> => item.artifactKind === "enumeration_page");
  if (pages.length !== payload.enumerationPages.length) fail("LAUNCH_PROOF_ARTIFACT");
  const dbPage = unique(payload.enumerationPages, row => String(row.artifact_sha256));
  for (const replay of pages) {
    const row = dbPage.get(replay.artifactSha256), d = replay.decoded;
    if (!row || String(row.plan_sha256) !== String(payload.proof.planSha256) || replay.planSha256 !== String(payload.proof.planSha256) || d.planSha256 !== replay.planSha256 || String(row.artifact_kind) !== "enumeration_page" || Number(row.pass) !== d.pass || Number(row.page_number) !== d.pageNumber || Number(row.terminal) !== Number(d.terminal)
      || String(row.form_type) !== d.provenance.formType || (d.provenance.kind === "daily_partition" ? row.requested_file_number !== null || sourceCutoff(String(row.receipt_date)) !== d.provenance.receiptDate : row.receipt_date !== null || String(row.requested_file_number) !== String(d.provenance.requestedFileNumber))) fail("LAUNCH_PROOF_ARTIFACT");
  }
  const expectedSourcePages = pages.map(page => fecSourcePageIdentitySha256(page.artifactSha256)).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  if (canonical(ledgerReplay.decoded.sourcePageIdentities) !== canonical(expectedSourcePages)) fail("LAUNCH_PROOF_ARTIFACT");
  const decodedOccurrences = pages.flatMap(page => page.decoded.terminal ? [] : page.decoded.records.map(record => ({ page, record })));
  if (pages.some(page => page.decoded.terminal && (page.decoded.records.length || page.decoded.recordMultiplicity.length)) || payload.pageLineage.some(edge => pages.find(page => page.artifactSha256 === String(edge.page_sha256))?.decoded.terminal)) fail("LAUNCH_PROOF_ARTIFACT");
  const lineage = unique(payload.pageLineage, edge => `${edge.ledger_sha256}\u0000${edge.page_sha256}\u0000${edge.pass}\u0000${edge.occurrence_index}`);
  if (lineage.size !== decodedOccurrences.length) fail("LAUNCH_PROOF_ARTIFACT");
  for (const { page, record } of decodedOccurrences) {
    const edge = lineage.get(`${ledgerReplay.artifactSha256}\u0000${page.artifactSha256}\u0000${page.decoded.pass}\u0000${record.occurrenceIndex}`);
    const db = dbByHash.get(record.entryIdentitySha256);
    if (!edge || !db || String(edge.file_number) !== String(db.file_number) || fecFilingIdentitySha256(record.identity) !== record.entryIdentitySha256) fail("LAUNCH_PROOF_ARTIFACT");
  }
  const pageGroups = grouped(decodedOccurrences, item => item.page.artifactSha256);
  for (const occurrences of pageGroups.values()) if (occurrences.map(item => item.record.occurrenceIndex).sort((a, b) => a - b).some((n, i) => n !== i + 1)) fail("LAUNCH_PROOF_ARTIFACT");
  const passRecords = (pass: 1 | 2) => decodedOccurrences.filter(item => item.page.decoded.pass === pass).map(item => ({ identity: item.record.identity, occurrenceIndex: item.record.occurrenceIndex }));
  const pass1 = fecPassOccurrenceDigestSha256(passRecords(1)), pass2 = fecPassOccurrenceDigestSha256(passRecords(2));
  if (pass1 !== pass2 || ledgerReplay.decoded.pass1DigestSha256 !== pass1 || ledgerReplay.decoded.pass2DigestSha256 !== pass2) fail("LAUNCH_PROOF_ARTIFACT");
  const predecessor = new Map<number, number>(), successors = new Set<number>();
  for (const entry of ledgerReplay.decoded.entries) { const previous = entry.identity.previousFileNumber; if (previous !== null) { if (predecessor.has(entry.identity.fileNumber) || successors.has(previous)) fail("LAUNCH_PROOF_ARTIFACT"); predecessor.set(entry.identity.fileNumber, previous); successors.add(previous); } }
  for (const start of predecessor.keys()) { const seen = new Set<number>(); for (let at: number | undefined = start; at !== undefined; at = predecessor.get(at)) { if (seen.has(at) || seen.size > 100) fail("LAUNCH_PROOF_ARTIFACT"); seen.add(at); } }
  for (const entry of ledgerReplay.decoded.entries) { const derived: number[] = []; for (let at: number | undefined = entry.identity.fileNumber; at !== undefined; at = predecessor.get(at)) derived.unshift(at); if (canonical(derived) !== canonical(entry.identity.authoritativeAmendmentChain)) fail("LAUNCH_PROOF_ARTIFACT"); }
  const exactEdges = [...predecessor].map(([file, previous]) => `${file}\u0000${previous}`).sort(ascii);
  const dbEdges = payload.amendmentLinks.map(row => `${row.file_number}\u0000${row.predecessor_file_number}`).sort(ascii);
  if (canonical(exactEdges) !== canonical(dbEdges)) fail("LAUNCH_PROOF_ARTIFACT");
  const old = new Set(ledgerReplay.decoded.entries.filter(entry => entry.identity.receiptDate < "2025-01-01").map(entry => entry.identity.fileNumber));
  const requiredLookup = new Set([...predecessor.values()].filter(file => old.has(file)));
  const lookupPages = grouped(pages.filter(page => page.decoded.provenance.kind === "predecessor_lookup"), page => `${page.decoded.pass}\u0000${page.decoded.provenance.kind === "predecessor_lookup" ? page.decoded.provenance.requestedFileNumber : ""}`);
  if (lookupPages.size !== requiredLookup.size * 2 || [...lookupPages.entries()].some(([bucket, items]) => { const [, file] = bucket.split("\u0000"); return !requiredLookup.has(Number(file)) || items.length !== 2 || !items.some(page => page.decoded.pageNumber === 1 && !page.decoded.terminal) || !items.some(page => page.decoded.pageNumber === 2 && page.decoded.terminal); })) fail("LAUNCH_PROOF_ARTIFACT");
  for (const entry of ledgerReplay.decoded.entries) {
    const occurrences = (pass: 1 | 2) => decodedOccurrences.filter(item => item.page.decoded.pass === pass && item.record.entryIdentitySha256 === entry.entryIdentitySha256);
    if (requiredLookup.has(entry.identity.fileNumber)) {
      for (const pass of [1, 2] as const) { const found = occurrences(pass); if (found.length !== 1 || found[0]!.page.decoded.provenance.kind !== "predecessor_lookup" || found[0]!.page.decoded.provenance.requestedFileNumber !== entry.identity.fileNumber || found[0]!.page.decoded.provenance.formType !== entry.identity.canonicalFormType || found[0]!.page.decoded.pageNumber !== 1) fail("LAUNCH_PROOF_ARTIFACT"); const terminal = pages.find(page => page.decoded.pass === pass && page.decoded.provenance.kind === "predecessor_lookup" && page.decoded.provenance.requestedFileNumber === entry.identity.fileNumber && page.decoded.pageNumber === 2); if (!terminal?.decoded.terminal) fail("LAUNCH_PROOF_ARTIFACT"); }
    } else if (occurrences(1).length !== occurrences(2).length || !occurrences(1).length || [...occurrences(1), ...occurrences(2)].some(item => item.page.decoded.provenance.kind !== "daily_partition")) fail("LAUNCH_PROOF_ARTIFACT");
  }
  const mapped = new Set(payload.mappings.map(row => String(row.fec_candidate_id)).filter(id => isFecCandidateId(id)));
  const entries = new Map(payload.filingLedgerEntries.map(row => [`${row.ledger_sha256}\u0000${row.file_number}`, row]));
  const alternates = new Map<string, FecV2GraphRow>();
  for (const alternate of payload.alternateScoping) { const key = `${alternate.sanitized_artifact_sha256}`; if (alternates.has(key)) fail("LAUNCH_PROOF_ARTIFACT"); alternates.set(key, alternate); }
  for (const filing of payload.sanitizedFilings) {
    const replay = byArtifact.get(String(filing.artifact_sha256)), decoded = replay?.artifactKind === "sanitized_filing" ? replay.decoded : undefined, entry = entries.get(`${filing.ledger_sha256}\u0000${filing.file_number}`);
    const reportDate = (value: unknown): string | null | undefined => value === null ? null : value === undefined ? undefined : sourceCutoff(String(value));
    if (!replay || !decoded || !entry || String(decoded.fileNumber) !== String(filing.file_number) || decoded.ledgerIdentitySha256 !== String(filing.ledger_identity_sha256) || decoded.ledgerIdentitySha256 !== String(entry.entry_identity_sha256) || decoded.reportDate !== reportDate(filing.report_date) || decoded.reportDate !== reportDate(entry.report_date) || decoded.semanticSha256 !== canonicalSha256({ fileNumber: decoded.fileNumber, ledgerIdentitySha256: decoded.ledgerIdentitySha256, reportDate: decoded.reportDate, candidateIds: decoded.candidateIds, scopeConclusion: decoded.scopeConclusion })) fail("LAUNCH_PROOF_ARTIFACT");
    const intersects = decoded.candidateIds.some(id => mapped.has(id)), alternate = alternates.get(String(filing.artifact_sha256));
    if (decoded.scopeConclusion === "inside_candidate_targets" ? !intersects || !!alternate : intersects || !alternate || String(alternate.ledger_sha256) !== String(filing.ledger_sha256) || String(alternate.file_number) !== String(filing.file_number) || String(alternate.conclusion) !== "outside_candidate_targets") fail("LAUNCH_PROOF_ARTIFACT");
    alternates.delete(String(filing.artifact_sha256));
  }
  if (alternates.size) fail("LAUNCH_PROOF_ARTIFACT");
}
const descriptor = (row: FecV2Row): FecV2ArtifactDescriptor => ({ receiptId: String(row.receipt_id), objectKey: String(row.object_key), versionId: String(row.version_id), etag: String(row.etag), artifactSha256: String(row.artifact_sha256), byteSize: decimal(row.byte_size).toString(), artifactKind: String(row.artifact_kind), upstreamEntitySha256: row.upstream_entity_sha256 === null ? null : String(row.upstream_entity_sha256), retrievedAt: dateIso(row.retrieved_at), snapshotId: String(row.snapshot_id), planSha256: String(row.plan_sha256) });
function freezeDeep<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}
function isFecV2ArtifactBundle(value: unknown, proof: FecV2PublicationProof): value is FecV2ArtifactVerificationBundle {
  return !!value && typeof value === "object"
    && (value as Record<PropertyKey, unknown>)[fecV2ArtifactBundleBrand] === true
    && (value as FecV2ArtifactVerificationBundle).proofReleaseId === proof.releaseId
    && (value as FecV2ArtifactVerificationBundle).proofPlanSha256 === proof.planSha256
    && Array.isArray((value as FecV2ArtifactVerificationBundle).transcript)
    && Object.isFrozen(value);
}
export async function prepareFecV2ArtifactTranscriptWithClient(client: PoolClient, proof: FecV2PublicationProof, artifactVerifier: FecV2ArtifactVerifier, controls: FecV2ReplayControls): Promise<FecV2ArtifactVerificationBundle> {
  const live = (): void => { if (!(controls.signal instanceof AbortSignal) || !Number.isFinite(controls.deadlineMs) || controls.signal.aborted || Date.now() >= controls.deadlineMs) fail("LAUNCH_PROOF_ARTIFACT"); };
  const bounded = async <T>(work: Promise<T>): Promise<T> => {
    live();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stop: (() => void) | undefined;
    const stopped = new Promise<never>((_, reject) => {
      stop = () => reject(new LaunchProofError("LAUNCH_PROOF_ARTIFACT"));
      controls.signal.addEventListener("abort", stop, { once: true });
      timer = setTimeout(stop, Math.max(0, controls.deadlineMs - Date.now()));
    });
    try { const value = await Promise.race([work, stopped]); live(); return value; }
    finally { if (timer) clearTimeout(timer); if (stop) controls.signal.removeEventListener("abort", stop); }
  };
  live();
  if (!fecV2PublicationProofSchema.safeParse(proof).success) fail("LAUNCH_PROOF_MALFORMED");
  const result = await bounded(client.query<FecV2ReceiptRow>("SELECT receipt_id,plan_sha256,artifact_sha256,artifact_kind,canonical_byte_size,upstream_entity_sha256,object_key,version_id,etag,byte_size,retrieved_at,snapshot_id FROM fec_v2_artifact_receipts WHERE release_id=$1 AND plan_sha256=$2 ORDER BY receipt_id COLLATE \"C\"", [proof.releaseId, proof.planSha256]));
  const targetResult = await bounded(client.query<{ fec_candidate_id: string | null }>("SELECT fec_candidate_id FROM fec_v2_candidate_mappings WHERE release_id=$1 AND plan_sha256=$2 AND fec_candidate_id IS NOT NULL ORDER BY fec_candidate_id COLLATE \"C\"", [proof.releaseId, proof.planSha256]));
  live();
  const targetCandidateIds = targetResult.rows.map(row => row.fec_candidate_id).filter((id): id is string => id !== null);
  if (targetCandidateIds.some((id, index) => !isFecCandidateId(id) || index > 0 && Buffer.compare(Buffer.from(targetCandidateIds[index - 1]!), Buffer.from(id)) >= 0)) fail("LAUNCH_PROOF_ARTIFACT");
  const descriptors = result.rows.map(row => descriptor(row as unknown as FecV2Row)); const seen = new Set<string>(); const transcript: FecV2ArtifactTranscript[] = [];
  for (const item of descriptors) {
    live();
    if (!item.versionId || !item.etag || !sha256.safeParse(item.artifactSha256).success || !/^\d+$/.test(item.byteSize) || BigInt(item.byteSize) > BigInt(64 * 1024 * 1024) || seen.has(item.receiptId)) fail("LAUNCH_PROOF_ARTIFACT");
    seen.add(item.receiptId);
    let bytes: Uint8Array | undefined;
    try {
      const received = await bounded(artifactVerifier.readCanonicalBytes(item, controls));
      live();
      if (!ArrayBuffer.isView(received) || Object.prototype.toString.call(received) !== "[object Uint8Array]" || received.buffer instanceof SharedArrayBuffer || received.byteLength > 64 * 1024 * 1024) fail("LAUNCH_PROOF_ARTIFACT");
      // Snapshot at the capability boundary: a verifier retains no mutable replay input.
      bytes = Uint8Array.from(received);
      live();
      const replay = buildFecV2ArtifactTranscriptFromCanonicalBytes(item, bytes, { signal: controls.signal, deadlineMs: controls.deadlineMs, targetCandidateIds });
      live();
      transcript.push(freezeDeep(replay));
    } catch { fail("LAUNCH_PROOF_ARTIFACT"); }
    finally { bytes?.fill(0); }
  }
  live();
  transcript.sort((left, right) => ascii(left.receiptId, right.receiptId));
  return freezeDeep({ proofReleaseId: proof.releaseId, proofPlanSha256: proof.planSha256, transcript, [fecV2ArtifactBundleBrand]: true });
}
/** Exact V2 graph, deliberately using only named projections. */
export async function buildFecV2PublicationPayloadWithClient(client: PoolClient, proof: FecV2PublicationProof): Promise<FecV2CanonicalPayload> {
  if (!fecV2PublicationProofSchema.safeParse(proof).success) fail("LAUNCH_PROOF_MALFORMED");
  const release = await client.query<{ id: string; source_cutoff: Date | string }>("SELECT id,source_cutoff FROM data_releases WHERE id=$1", [proof.releaseId]); if (release.rowCount !== 1 || sourceCutoff(release.rows[0]!.source_cutoff) !== "2026-07-18") fail("LAUNCH_PROOF_RELEASE");
  const planResult = await client.query<FecV2PlanRow>("SELECT plan_sha256,origin_release_id,receipt_cutoff,campaign_cycle,source_lock_sha256,target_universe_sha256,canonical_sha256,sealed_at FROM fec_v2_plans WHERE release_id=$1 AND plan_sha256=$2", [proof.releaseId, proof.planSha256]);
  const allPlans = await client.query<{ plan_sha256: string }>("SELECT plan_sha256 FROM fec_v2_plans WHERE release_id=$1 ORDER BY plan_sha256 COLLATE \"C\"", [proof.releaseId]); if (planResult.rowCount !== 1 || allPlans.rowCount !== 1 || !planResult.rows[0]?.sealed_at || planResult.rows[0]?.campaign_cycle !== 2026 || sourceCutoff(String(planResult.rows[0].receipt_cutoff)) !== "2026-07-18") fail("LAUNCH_PROOF_MISSING");
  const routeResult = await client.query<{ route: string; plan_sha256: string }>("SELECT route,plan_sha256 FROM finance_proof_routes WHERE release_id=$1", [proof.releaseId]); if (routeResult.rowCount !== 1 || routeResult.rows[0]?.route !== "fec_v2_exact_election" || routeResult.rows[0]?.plan_sha256 !== proof.planSha256) fail("LAUNCH_PROOF_RELEASE");
  const load = async <K extends keyof typeof v2Columns>(key: K): Promise<FecV2Row[]> => (await client.query<FecV2Row>(`SELECT ${v2Columns[key]}${key === "sanitizedFilings" ? ",ledger_identity_sha256" : ""} FROM ${v2Table[key]} WHERE release_id=$1 AND plan_sha256=$2 ORDER BY ${fecV2NaturalOrder[key]}`, [proof.releaseId, proof.planSha256])).rows;
  const loaded = Object.fromEntries(await Promise.all((Object.keys(v2Columns) as (keyof typeof v2Columns)[]).map(async key => [key, await load(key)]))) as Record<keyof typeof v2Columns, FecV2Row[]>;
  const universe = await client.query<{ seat_cycle_id: string }>('SELECT seat_cycle_id FROM release_profile_seats WHERE release_id=$1 ORDER BY seat_cycle_id COLLATE "C"', [proof.releaseId]);
  const snapshots = await client.query<FecV2SnapshotRow>("SELECT s.id snapshot_id,s.source_id,s.source_url,s.published_at,s.retrieved_at,s.checksum_sha256,s.parser_version,s.license,s.usage_status,m.origin_release_id,m.receipt_set_digest_sha256,m.sealed_at FROM source_snapshots s JOIN fec_v2_snapshot_metadata m ON m.release_id=s.release_id AND m.snapshot_id=s.id WHERE s.release_id=$1 AND m.plan_sha256=$2 ORDER BY s.id COLLATE \"C\"", [proof.releaseId, proof.planSha256]);
  const receiptRows = await client.query<FecV2ReceiptRow>("SELECT receipt_id,plan_sha256,artifact_sha256,artifact_kind,canonical_byte_size,upstream_entity_sha256,object_key,version_id,etag,byte_size,retrieved_at,snapshot_id FROM fec_v2_artifact_receipts WHERE release_id=$1 AND plan_sha256=$2 ORDER BY receipt_id COLLATE \"C\"", [proof.releaseId, proof.planSha256]);
  const manifest = await client.query<FecV2Row>("SELECT schema_version,canonical_data_checksum_sha256,geometry_checksum_sha256,content_checksum_sha256 FROM release_manifests WHERE release_id=$1", [proof.releaseId]); const gate = await client.query<FecV2Row>("SELECT schema_version,manifest_checksum_sha256,geometry_checksum_sha256,content_checksum_sha256,domain_count,domain_checksum_sha256 FROM nationwide_validation_gates WHERE release_id=$1", [proof.releaseId]);
  const payload = { schemaVersion: 2 as const, kind: "fec_v2_exact_election" as const, proof, release: { id: proof.releaseId, sourceCutoff: dateIso(release.rows[0]!.source_cutoff) }, route: { route: routeResult.rows[0]!.route, planSha256: routeResult.rows[0]!.plan_sha256 }, plan: planResult.rows[0]! as unknown as FecV2Row, targets: loaded.targets, sourceSnapshots: snapshots.rows as unknown as FecV2Row[], artifacts: loaded.artifacts, receipts: receiptRows.rows.map(row => descriptor(row as unknown as FecV2Row)), enumerationPages: loaded.enumerationPages, filingLedgers: loaded.filingLedgers, filingLedgerEntries: loaded.filingLedgerEntries, pageLineage: loaded.pageLineage, amendmentLinks: loaded.amendmentLinks, sanitizedFilings: loaded.sanitizedFilings, alternateScoping: loaded.alternateScoping, mappings: loaded.mappings, committees: loaded.committees, elections: loaded.elections, closures: loaded.closures, closureReceipts: loaded.closureReceipts, closureSnapshots: loaded.closureSnapshots, coverage: loaded.coverage, aggregates: loaded.aggregates, dataSignatures: loaded.dataSignatures, manifest: manifest.rows[0]!, nationwideGate: gate.rows[0]!, digests: await loadDigests(client, proof.releaseId) };
  const exactSet = (left: readonly string[], right: readonly string[]) => left.length === right.length && [...left].sort(ascii).join("\u0000") === [...right].sort(ascii).join("\u0000");
  const targetRows = payload.targets as unknown as FecV2TargetRow[];
  const targetIds = targetRows.map(row => row.seat_cycle_id);
  if (targetIds.length !== 541 || new Set(targetIds).size !== 541 || !exactSet(targetIds, universe.rows.map(row => row.seat_cycle_id))) fail("LAUNCH_PROOF_COUNTS");
  const targets: FecPlanTarget[] = targetRows.map(row => row.kind === "candidate_resolution_required"
    ? { kind: "candidate_resolution_required", seatCycleId: row.seat_cycle_id }
    : row.kind === "terminal" && row.disposition !== null && row.evidence_sha256 !== null
      ? { kind: "terminal", seatCycleId: row.seat_cycle_id, disposition: row.disposition as "vacant" | "non_candidate" | "not_contested", evidenceSha256: row.evidence_sha256 }
      : fail("LAUNCH_PROOF_MALFORMED"));
  try {
    const plan: FecAcquisitionPlanV2 = { schemaVersion: 2, adapterVersion: "fec-receipt-cutoff-v2", releaseId: String(payload.plan.origin_release_id), receiptCutoff: "2026-07-18", campaignCycle: 2026, sourceLockSha256: String(payload.plan.source_lock_sha256), enumerationLowerBound: "2025-01-01", targetUniverseSha256: fecTargetUniverseSha256(targetIds), forms: ["F24", "F3", "F3X", "F5"], enumeration: { granularity: "day", serverOrderBy: "receipt_date", clientCanonicalOrderBy: "file_number", completePasses: 2 }, targets };
    const bytes = encodeFecAcquisitionPlan(plan); const planHash = fecAcquisitionPlanSha256(bytes);
    if (planHash !== proof.planSha256 || planHash !== payload.plan.plan_sha256 || planHash !== payload.plan.canonical_sha256 || plan.targetUniverseSha256 !== payload.plan.target_universe_sha256) fail("LAUNCH_PROOF_HASH");
  } catch (error) { if (error instanceof LaunchProofError) throw error; fail("LAUNCH_PROOF_MALFORMED"); }
  validateFecV2PublicationGraph(payload);
  return Object.freeze(payload);
}
type FecV2ReviewSubjectType = "fec_mapping" | "committee_mapping" | "outside_spending_election_mapping" | "finance_page_closure" | "finance_amendment_closure" | "finance_closure" | "outside_spending_closure" | "finance_terminal";
export type FecV2ExpectedReview = Readonly<{ reviewId: string; subjectType: FecV2ReviewSubjectType; subjectSha256: string; finalizesAt: string }>;
const v2Fields = (row: FecV2Row, fields: readonly string[]): Record<string, unknown> => Object.fromEntries(fields.map(field => [field, canonicalValue(row[field] as FecV2Scalar)]));
const v2Order = <T>(items: readonly T[], value: (item: T) => string): T[] => [...items].sort((left, right) => Buffer.compare(Buffer.from(value(left)), Buffer.from(value(right))));
const v2Date = (value: unknown, future = false): string => {
  if (value instanceof Date) { if (Number.isNaN(value.valueOf())) fail("LAUNCH_PROOF_SIGNATURE"); const iso = value.toISOString(); if (future && value.valueOf() > Date.now()) fail("LAUNCH_PROOF_SIGNATURE"); return iso; }
  if (typeof value !== "string") fail("LAUNCH_PROOF_SIGNATURE");
  const date = new Date(value); if (Number.isNaN(date.valueOf()) || date.toISOString() !== value || (future && date.valueOf() > Date.now())) fail("LAUNCH_PROOF_SIGNATURE"); return value;
};
const v2ReviewId = (originReleaseId: string, acquisitionPlanSha256: string, subjectType: FecV2ReviewSubjectType, subjectSha256: string): string => `fecv2_${canonicalSha256({ originReleaseId, acquisitionPlanSha256, subjectType, subjectSha256 }).slice(0, 32)}`;
/** Canonical closure-local sanitized-filing evidence; intentionally excludes incidental database fields. */
export function fecV2ClosureScopingStateSha256(payload: FecV2CanonicalPayload, closureId: string): string {
  const receiptIds = new Set(payload.closureReceipts.filter(row => String(row.closure_id) === closureId).map(row => String(row.receipt_id)));
  const receiptByArtifact = new Map(payload.receipts.filter(receipt => receiptIds.has(receipt.receiptId)).map(receipt => [receipt.artifactSha256, receipt]));
  const parentByArtifact = new Map(payload.artifacts.map(artifact => [String(artifact.artifact_sha256), artifact]));
  const state = payload.sanitizedFilings
    .filter(filing => receiptByArtifact.has(String(filing.artifact_sha256)))
    .map(filing => {
      const artifactSha256 = String(filing.artifact_sha256), receipt = receiptByArtifact.get(artifactSha256), parent = parentByArtifact.get(artifactSha256);
      if (!receipt || !parent) fail("LAUNCH_PROOF_SIGNATURE");
      const alternate = payload.alternateScoping.filter(row => String(row.sanitized_artifact_sha256) === artifactSha256 && String(row.ledger_sha256) === String(filing.ledger_sha256) && String(row.file_number) === String(filing.file_number));
      if (alternate.length > 1) fail("LAUNCH_PROOF_SIGNATURE");
      return { artifactSha256, receiptId: receipt.receiptId, ledgerSha256: String(filing.ledger_sha256), ledgerIdentitySha256: String(filing.ledger_identity_sha256), fileNumber: String(filing.file_number), reportDate: filing.report_date === null ? null : sourceCutoff(String(filing.report_date)), artifactParent: v2Fields(parent, ["plan_sha256", "artifact_sha256", "artifact_kind", "canonical_byte_size"]), alternateScoping: alternate[0] ? v2Fields(alternate[0], ["plan_sha256", "ledger_sha256", "file_number", "sanitized_artifact_sha256", "conclusion"]) : null };
    });
  return canonicalSha256(v2Order(state, item => canonical(item)));
}
/** Builds only versioned, named decision projections; never hashes database rows. */
export function buildFecV2ExpectedDataReviews(payload: FecV2CanonicalPayload): readonly FecV2ExpectedReview[] {
  const originReleaseId = String(payload.plan.origin_release_id), acquisitionPlanSha256 = String(payload.proof.planSha256);
  const make = (subjectType: FecV2ReviewSubjectType, subject: Record<string, unknown>, finalizesAt: unknown): FecV2ExpectedReview => {
    const root = { schemaVersion: 2, originReleaseId, acquisitionPlanSha256, subjectType, subject };
    const subjectSha256 = canonicalSha256(root);
    return Object.freeze({ reviewId: v2ReviewId(originReleaseId, acquisitionPlanSha256, subjectType, subjectSha256), subjectType, subjectSha256, finalizesAt: v2Date(finalizesAt) });
  };
  const mappings = payload.mappings.map(row => ({ row, subject: v2Fields(row, ["id", "plan_sha256", "seat_cycle_id", "target_kind", "outcome", "fec_candidate_id", "candidacy_id", "candidacy_contest_id", "evidence_sha256"]) }));
  const committees = payload.committees.map(row => ({ row, subject: v2Fields(row, ["id", "plan_sha256", "candidate_mapping_id", "committee_id", "designation", "evidence_sha256"]) }));
  const elections = payload.elections.map(row => ({ row, subject: v2Fields(row, ["id", "plan_sha256", "seat_cycle_id", "outcome", "candidate_mapping_id", "contest_id", "election_code", "election_date", "evidence_sha256"]) }));
  const closureByMapping = grouped(payload.closures.filter(row => row.candidate_mapping_id !== null), row => String(row.candidate_mapping_id));
  const dependentFinalization = (mappingId: string): string => {
    const dependent = closureByMapping.get(mappingId) ?? []; if (!dependent.length) fail("LAUNCH_PROOF_SIGNATURE");
    return dependent.map(row => v2Date(row.finalized_at)).sort(ascii)[0]!;
  };
  const expected: FecV2ExpectedReview[] = [];
  for (const item of mappings) expected.push(make("fec_mapping", item.subject, dependentFinalization(String(item.row.id))));
  for (const item of committees) expected.push(make("committee_mapping", item.subject, dependentFinalization(String(item.row.candidate_mapping_id))));
  for (const item of elections) expected.push(make("outside_spending_election_mapping", item.subject, dependentFinalization(String(item.row.candidate_mapping_id))));
  for (const ledger of payload.filingLedgers) {
    const ledgerSha = String(ledger.artifact_sha256), finalizesAt = ledger.finalized_at;
    const entries = v2Order(payload.filingLedgerEntries.filter(row => String(row.ledger_sha256) === ledgerSha).map(row => v2Fields(row, ["ledger_sha256", "file_number", "entry_identity_sha256", "canonical_form_type", "base_form_type", "report_type", "report_date", "receipt_date", "coverage_start", "coverage_end", "amendment_indicator", "filer_id", "committee_id", "electronic_status", "raw_source_availability"])), canonical);
    const lineage = v2Order(payload.pageLineage.filter(row => String(row.ledger_sha256) === ledgerSha).map(row => v2Fields(row, ["ledger_sha256", "file_number", "page_sha256", "pass", "occurrence_index"])), canonical);
    const pageHashes = new Set(payload.pageLineage.filter(row => String(row.ledger_sha256) === ledgerSha).map(row => String(row.page_sha256)));
    const pages = v2Order(payload.enumerationPages.filter(row => pageHashes.has(String(row.artifact_sha256))).map(row => v2Fields(row, ["plan_sha256", "artifact_sha256", "artifact_kind", "pass", "form_type", "receipt_date", "requested_file_number", "page_number", "terminal"])), canonical);
    const links = v2Order(payload.amendmentLinks.filter(row => String(row.ledger_sha256) === ledgerSha).map(row => v2Fields(row, ["ledger_sha256", "file_number", "predecessor_file_number"])), canonical);
    const ledgerSubject = v2Fields(ledger, ["plan_sha256", "artifact_sha256", "artifact_kind", "stable"]);
    expected.push(make("finance_page_closure", { ledger: ledgerSubject, enumerationPages: pages, pageLineage: lineage }, finalizesAt));
    expected.push(make("finance_amendment_closure", { ledger: ledgerSubject, ledgerEntries: entries, amendmentLinks: links }, finalizesAt));
  }
  const coverageByClosure = new Map(payload.coverage.map(row => [String(row.closure_id), row]));
  for (const closure of payload.closures) {
    const coverage = coverageByClosure.get(String(closure.id)); if (!coverage) fail("LAUNCH_PROOF_SIGNATURE");
    const seat = String(closure.seat_cycle_id);
    const state = v2Order([
      ...mappings.filter(item => String(item.row.seat_cycle_id) === seat).map(item => ({ subjectType: "fec_mapping", subject: item.subject })),
      ...committees.filter(item => String(item.row.candidate_mapping_id) === String(closure.candidate_mapping_id)).map(item => ({ subjectType: "committee_mapping", subject: item.subject })),
      ...elections.filter(item => String(item.row.seat_cycle_id) === seat).map(item => ({ subjectType: "outside_spending_election_mapping", subject: item.subject })),
    ], canonical);
    const selected = payload.targets.find(row => String(row.seat_cycle_id) === seat);
    if (!selected) fail("LAUNCH_PROOF_SIGNATURE");
    const selectedTarget = { seatCycleId: String(selected.seat_cycle_id), kind: String(selected.kind), disposition: selected.disposition === null ? null : String(selected.disposition), evidenceSha256: selected.evidence_sha256 === null ? null : String(selected.evidence_sha256) };
    const subject = { closure: v2Fields(closure, ["id", "plan_sha256", "seat_cycle_id", "target_kind", "subject_kind", "subject_identity", "candidate_mapping_id", "status"]), selectedTarget, coverage: v2Fields(coverage, ["plan_sha256", "seat_cycle_id", "closure_id", "subject_identity", "outcome", "support_cents", "oppose_cents"]), receiptIds: v2Order(payload.closureReceipts.filter(row => String(row.closure_id) === String(closure.id)).map(row => String(row.receipt_id)), value => value), snapshotIds: v2Order(payload.closureSnapshots.filter(row => String(row.closure_id) === String(closure.id)).map(row => String(row.snapshot_id)), value => value), candidateStateSha256: canonicalSha256(state), scopingStateSha256: fecV2ClosureScopingStateSha256(payload, String(closure.id)) };
    const finalizesAt = closure.finalized_at;
    const finance = make("finance_closure", subject, finalizesAt);
    if (String(closure.subject_sha256) !== finance.subjectSha256) fail("LAUNCH_PROOF_HASH");
    expected.push(finance);
    if (closure.subject_kind === "candidate") expected.push(make("outside_spending_closure", subject, finalizesAt));
    if (closure.subject_kind === "terminal") expected.push(make("finance_terminal", subject, finalizesAt));
  }
  const ids = new Set<string>(); for (const review of expected) if (ids.has(review.reviewId)) fail("LAUNCH_PROOF_SIGNATURE"); else ids.add(review.reviewId);
  return Object.freeze(v2Order(expected, review => review.reviewId).map(review => Object.freeze(review)));
}
export async function verifyFecV2DataReviewSignatures(payload: FecV2CanonicalPayload, resolver: PublicKeyResolver, verifier: SignatureVerifier): Promise<{ reviewerIds: ReadonlySet<string>; fingerprints: ReadonlySet<string>; latestSignedAt: string }> {
  const expected = buildFecV2ExpectedDataReviews(payload);
  const byId = new Map(expected.map(review => [review.reviewId, review]));
  if (byId.size !== expected.length || payload.dataSignatures.length !== expected.length) fail("LAUNCH_PROOF_SIGNATURE");
  const reviewerIds = new Set<string>(), fingerprints = new Set<string>(), ids = new Set<string>(), subjects = new Set<string>();
  let latestSignedAt = "";
  for (const signature of payload.dataSignatures) {
    const reviewId = String(signature.review_id), subjectType = String(signature.subject_type), subjectSha256 = String(signature.subject_sha256);
    const review = byId.get(reviewId), subjectKey = `${subjectType}\u0000${subjectSha256}`;
    if (!ids.add(reviewId) || !subjects.add(subjectKey) || !review || subjectType !== review.subjectType || subjectSha256 !== review.subjectSha256 || String(signature.origin_release_id) !== String(payload.plan.origin_release_id) || String(signature.plan_sha256) !== String(payload.proof.planSha256)) fail("LAUNCH_PROOF_SIGNATURE");
    const signedAt = v2Date(signature.signed_at, true);
    if (signedAt >= review.finalizesAt) fail("LAUNCH_PROOF_SIGNATURE");
    const key = await resolver.resolve(String(signature.key_id), String(signature.reviewer_id));
    if (!key || key.reviewerRole !== "data_reviewer" || !key.allowedSubjectTypes.includes(review.subjectType) || resolvedEd25519Fingerprint(key.publicKey) !== key.publicKeyFingerprint || key.publicKeyFingerprint !== String(signature.public_key_fingerprint)) fail("LAUNCH_PROOF_SIGNATURE");
    await verifySignedReviewWithKey({ reviewId, subjectType: review.subjectType, subjectSha256, reviewerId: String(signature.reviewer_id), signedAt, signature: String(signature.signature), keyId: String(signature.key_id) }, key, verifier);
    reviewerIds.add(String(signature.reviewer_id)); fingerprints.add(String(signature.public_key_fingerprint));
    if (signedAt > latestSignedAt) latestSignedAt = signedAt;
  }
  if (ids.size !== byId.size || !latestSignedAt) fail("LAUNCH_PROOF_SIGNATURE");
  return { reviewerIds, fingerprints, latestSignedAt };
}
function resolvedEd25519Fingerprint(publicKey: string): string {
  try { const key = createPublicKey(publicKey); if (key.asymmetricKeyType !== "ed25519") fail("LAUNCH_PROOF_SIGNATURE"); return createHash("sha256").update(key.export({ type: "spki", format: "der" })).digest("hex"); } catch (error) { if (error instanceof LaunchProofError) throw error; fail("LAUNCH_PROOF_SIGNATURE"); }
}
export interface FecV2PublicationSignatureRow { signature_id: string; plan_sha256: string; canonical_sha256: string; reviewer_id: string; signed_at: Date | string; signature: string; key_id: string; public_key_fingerprint: string; }
export interface FecV2PublicationProofRow { proof_id: string; signature_id: string; canonical_sha256: string; created_at: Date | string; }
export interface FecV2PublicationEvidence { publicationSignatures: readonly FecV2PublicationSignatureRow[]; publicationProofs: readonly FecV2PublicationProofRow[]; }
export interface FecV2DataReviewResult { reviewerIds: ReadonlySet<string>; fingerprints: ReadonlySet<string>; latestSignedAt: string; }
export const fecV2PublicationProofQuery = 'SELECT id proof_id,signature_id,canonical_sha256,created_at FROM fec_v2_publication_proofs WHERE release_id=$1 ORDER BY id COLLATE "C"';

/** Verifies the complete, release-local V2 publication evidence set. */
export async function verifyFecV2PublicationEvidence(payload: FecV2CanonicalPayload, proof: FecV2PublicationProof, evidence: FecV2PublicationEvidence, dataReviewResult: FecV2DataReviewResult, resolver: PublicKeyResolver, verifier: SignatureVerifier, verifiedAt: Date | string = new Date()): Promise<string> {
  if (!fecV2PublicationProofSchema.safeParse(proof).success || proof.releaseId !== payload.release.id || proof.planSha256 !== payload.proof.planSha256 || evidence.publicationSignatures.length !== 1 || evidence.publicationProofs.length !== 1) fail("LAUNCH_PROOF_SIGNATURE");
  const canonicalSha = canonicalSha256(payload);
  const signature = evidence.publicationSignatures[0]!, publicationProof = evidence.publicationProofs[0]!;
  const latestSignedAt = v2Date(dataReviewResult.latestSignedAt);
  const finalizations = [...payload.filingLedgers.map(row => row.finalized_at), ...payload.closures.map(row => row.finalized_at)].map(value => v2Date(value));
  if (!latestSignedAt || !finalizations.length || finalizations.some(finalizedAt => latestSignedAt >= finalizedAt)) fail("LAUNCH_PROOF_SIGNATURE");
  const signedAt = v2Date(signature.signed_at), createdAt = v2Date(publicationProof.created_at), sealedAt = v2Date(payload.plan.sealed_at), checkedAt = v2Date(verifiedAt);
  const expectedPublicationId = `fecv2pub_${canonicalSha256({ releaseId: proof.releaseId, acquisitionPlanSha256: proof.planSha256, subjectSha256: canonicalSha }).slice(0, 32)}`;
  if (publicationProof.proof_id !== proof.proofId || publicationProof.signature_id !== signature.signature_id || signature.signature_id !== expectedPublicationId || signature.plan_sha256 !== proof.planSha256 || String(payload.route.planSha256) !== proof.planSha256 || String(payload.plan.plan_sha256) !== proof.planSha256 || publicationProof.canonical_sha256 !== canonicalSha || signature.canonical_sha256 !== canonicalSha || signedAt <= latestSignedAt || finalizations.some(finalizedAt => signedAt <= finalizedAt) || signedAt <= sealedAt || createdAt <= signedAt || signedAt > checkedAt || createdAt > checkedAt || dataReviewResult.reviewerIds.has(signature.reviewer_id) || dataReviewResult.fingerprints.has(signature.public_key_fingerprint)) fail("LAUNCH_PROOF_SIGNATURE");
  const key = await resolver.resolve(signature.key_id, signature.reviewer_id);
  if (!key || resolvedEd25519Fingerprint(key.publicKey) !== key.publicKeyFingerprint || key.publicKeyFingerprint !== signature.public_key_fingerprint) fail("LAUNCH_PROOF_SIGNATURE");
  await verifySignedReviewWithKey({ reviewId: signature.signature_id, subjectType: "publication", subjectSha256: canonicalSha, reviewerId: signature.reviewer_id, signedAt, signature: signature.signature, keyId: signature.key_id }, key, verifier);
  return canonicalSha;
}
export async function verifyFecV2PublicationProofWithClient(client: PoolClient, proof: FecV2PublicationProof, resolver: PublicKeyResolver, verifier: SignatureVerifier, bundle: FecV2ArtifactVerificationBundle): Promise<string> {
  if (!isFecV2ArtifactBundle(bundle, proof)) fail("LAUNCH_PROOF_ARTIFACT");
  const payload = await buildFecV2PublicationPayloadWithClient(client, proof);
  const transcript = bundle.transcript;
  if (!transcript || transcript.length !== payload.receipts.length || new Set(transcript.map(row => row.receiptId)).size !== transcript.length) fail("LAUNCH_PROOF_ARTIFACT");
  for (const receipt of payload.receipts) { const replay = transcript.find(item => item.receiptId === receipt.receiptId); if (!replay || !validateFecV2ArtifactTranscript(replay, receipt)) fail("LAUNCH_PROOF_ARTIFACT"); }
  validateFecV2ArtifactSemantics(payload, transcript);
  const recomputed = await Promise.all((Object.keys(contentDomains) as (keyof typeof contentDomains)[]).sort(ascii).map(async domain => ({ domain, ...await computeReleaseDigest(client, proof.releaseId, domain) }))); if (canonical(recomputed) !== canonical(payload.digests.map(row => ({ domain: row.domain, rowCount: Number(row.row_count), sha256: row.sha256 })))) fail("LAUNCH_PROOF_DIGESTS");
  const reconstructedManifest = await loadNationwideManifest(client, proof.releaseId);
  const canonicalDataChecksum = computeCanonicalDataChecksum(reconstructedManifest);
  if (payload.manifest.schema_version !== 2 || canonicalDataChecksum !== payload.manifest.canonical_data_checksum_sha256 || expectedContentChecksum(payload.manifest as Parameters<typeof expectedContentChecksum>[0]) !== payload.manifest.content_checksum_sha256 || payload.nationwideGate.schema_version !== 2 || payload.nationwideGate.manifest_checksum_sha256 !== canonicalDataChecksum || payload.nationwideGate.geometry_checksum_sha256 !== payload.manifest.geometry_checksum_sha256 || payload.nationwideGate.content_checksum_sha256 !== payload.manifest.content_checksum_sha256 || Number(payload.nationwideGate.domain_count) !== 7 || payload.nationwideGate.domain_checksum_sha256 !== domainSummary(recomputed)) fail("LAUNCH_PROOF_DIGESTS");
  const dataReviewResult = await verifyFecV2DataReviewSignatures(payload, resolver, verifier);
  const [signatures, proofs] = await Promise.all([
    client.query<FecV2PublicationSignatureRow>("SELECT id signature_id,plan_sha256,canonical_sha256,reviewer_id,signed_at,signature,key_id,public_key_fingerprint FROM fec_v2_publication_signatures WHERE release_id=$1 ORDER BY id COLLATE \"C\"", [proof.releaseId]),
    client.query<FecV2PublicationProofRow>(fecV2PublicationProofQuery, [proof.releaseId]),
  ]);
  return verifyFecV2PublicationEvidence(payload, proof, { publicationSignatures: signatures.rows, publicationProofs: proofs.rows }, dataReviewResult, resolver, verifier);
}

async function assertLoadedFinanceContent(client: PoolClient, releaseId: string): Promise<void> {
  const result = await client.query<{ invalid: string | number }>(`
    SELECT count(*) invalid FROM finance_terminal_dispositions terminal
    WHERE terminal.release_id=$1 AND (
      (terminal.outcome='approved_finance' AND (
        NOT EXISTS(SELECT 1 FROM seat_finance_summaries summary WHERE (summary.release_id,summary.seat_cycle_id)=(terminal.release_id,terminal.seat_cycle_id) AND summary.filing_id IS NOT NULL AND summary.missing_reason IS NULL)
        OR NOT EXISTS(SELECT 1 FROM finance_aggregates aggregate WHERE (aggregate.release_id,aggregate.seat_cycle_id)=(terminal.release_id,terminal.seat_cycle_id))
      ))
      OR (terminal.outcome<>'approved_finance' AND (
        EXISTS(SELECT 1 FROM seat_finance_summaries summary WHERE (summary.release_id,summary.seat_cycle_id)=(terminal.release_id,terminal.seat_cycle_id) AND summary.filing_id IS NOT NULL)
        OR EXISTS(SELECT 1 FROM fec_filing_summaries filing WHERE (filing.release_id,filing.seat_cycle_id)=(terminal.release_id,terminal.seat_cycle_id))
        OR EXISTS(SELECT 1 FROM finance_aggregates aggregate WHERE (aggregate.release_id,aggregate.seat_cycle_id)=(terminal.release_id,terminal.seat_cycle_id) AND (aggregate.cash_on_hand IS NOT NULL OR aggregate.receipts IS NOT NULL OR aggregate.disbursements IS NOT NULL))
      ))
    )`, [releaseId]);
  if (Number(result.rows[0]?.invalid) !== 0) fail("LAUNCH_PROOF_COUNTS");
  const structural = await client.query<{ invalid: string | number }>(`
    SELECT count(*) invalid FROM finance_coverage_closures closure
    WHERE closure.release_id=$1 AND closure.kind<>'summary' AND (closure.status='complete') IS DISTINCT FROM CASE closure.kind
      WHEN 'category' THEN EXISTS(SELECT 1 FROM funding_category_aggregates row WHERE (row.release_id,row.seat_cycle_id)=(closure.release_id,closure.seat_cycle_id))
      WHEN 'organization' THEN EXISTS(SELECT 1 FROM funding_organization_aggregates row WHERE (row.release_id,row.seat_cycle_id)=(closure.release_id,closure.seat_cycle_id))
      WHEN 'outside_spending' THEN EXISTS(SELECT 1 FROM outside_spending_aggregates row WHERE (row.release_id,row.seat_cycle_id)=(closure.release_id,closure.seat_cycle_id))
      ELSE false END`, [releaseId]);
  if (Number(structural.rows[0]?.invalid) !== 0) fail("LAUNCH_PROOF_COUNTS");
}

async function assertLoadedElectionContent(client: PoolClient, releaseId: string): Promise<void> {
  const result = await client.query<{ invalid: string | number }>(`
    SELECT count(*) invalid
    FROM election_inventory_rows inventory
    JOIN election_result_envelopes envelope ON (envelope.release_id,envelope.inventory_row_id)=(inventory.release_id,inventory.id)
    WHERE inventory.release_id=$1 AND envelope.disposition='approved' AND NOT EXISTS(
      SELECT 1 FROM contests contest
      WHERE (contest.release_id,contest.id)=(inventory.release_id,inventory.contest_key)
        AND contest.round='general'
        AND contest.certification_status=envelope.certification_status
        AND contest.reporting_completeness_percent=100
        AND contest.denominator_votes=envelope.denominator_votes
        AND contest.allocation_method=envelope.allocation_method
        AND (contest.allocation_method='none' OR contest.allocation_coverage_percent=100)
        AND EXISTS(SELECT 1 FROM contest_lineage lineage JOIN source_snapshots snapshot ON (snapshot.release_id,snapshot.id)=(lineage.release_id,lineage.snapshot_id) WHERE (lineage.release_id,lineage.contest_id)=(contest.release_id,contest.id) AND snapshot.usage_status='approved')
        AND NOT EXISTS(
          (SELECT result.option_key,result.votes FROM election_result_rows result WHERE (result.release_id,result.envelope_id)=(envelope.release_id,envelope.id)
           EXCEPT SELECT option.id,election.votes FROM result_options option JOIN election_results election ON (election.release_id,election.contest_id,election.result_option_id)=(option.release_id,option.contest_id,option.id) WHERE (option.release_id,option.contest_id)=(contest.release_id,contest.id))
          UNION ALL
          (SELECT option.id,election.votes FROM result_options option JOIN election_results election ON (election.release_id,election.contest_id,election.result_option_id)=(option.release_id,option.contest_id,option.id) WHERE (option.release_id,option.contest_id)=(contest.release_id,contest.id)
           EXCEPT SELECT result.option_key,result.votes FROM election_result_rows result WHERE (result.release_id,result.envelope_id)=(envelope.release_id,envelope.id))
        )
        AND NOT EXISTS(
          SELECT 1 FROM result_options option
          WHERE (option.release_id,option.contest_id)=(contest.release_id,contest.id)
            AND NOT EXISTS(SELECT 1 FROM election_result_lineage lineage JOIN source_snapshots snapshot ON (snapshot.release_id,snapshot.id)=(lineage.release_id,lineage.snapshot_id) WHERE (lineage.release_id,lineage.contest_id,lineage.result_option_id)=(option.release_id,option.contest_id,option.id) AND snapshot.usage_status='approved')
        )
    )`, [releaseId]);
  if (Number(result.rows[0]?.invalid) !== 0) fail("LAUNCH_PROOF_COUNTS");
  const unavailable = await client.query<{ invalid: string | number }>(`
    SELECT count(*) invalid FROM election_inventory_rows inventory
    JOIN election_result_envelopes envelope ON (envelope.release_id,envelope.inventory_row_id)=(inventory.release_id,inventory.id)
    WHERE inventory.release_id=$1 AND envelope.disposition='unavailable'
      AND EXISTS(SELECT 1 FROM contests contest WHERE (contest.release_id,contest.id)=(inventory.release_id,inventory.contest_key))`, [releaseId]);
  if (Number(unavailable.rows[0]?.invalid) !== 0) fail("LAUNCH_PROOF_COUNTS");
  const outsideInventory = await client.query<{ invalid: string | number }>(`
    SELECT count(*) invalid FROM contests contest
    WHERE contest.release_id=$1 AND EXTRACT(YEAR FROM contest.election_date)::int IN(2020,2022,2024)
      AND NOT EXISTS(SELECT 1 FROM election_inventory_rows inventory WHERE (inventory.release_id,inventory.contest_key)=(contest.release_id,contest.id))`, [releaseId]);
  if (Number(outsideInventory.rows[0]?.invalid) !== 0) fail("LAUNCH_PROOF_COUNTS");
}

export async function buildFinancePublicationPayloadWithClient(client: PoolClient, proof: FinancePublicationProof): Promise<FinanceCanonicalPayload> {
  if (!financePublicationProofSchema.safeParse(proof).success) fail("LAUNCH_PROOF_MALFORMED");
  await assertRelease(client, proof.releaseId);
  const profile = await rows(client, 'SELECT rps.seat_cycle_id,sc.occupancy_status FROM release_profile_seats rps JOIN seat_cycles sc ON (sc.release_id,sc.id)=(rps.release_id,rps.seat_cycle_id) WHERE rps.release_id=$1 ORDER BY rps.seat_cycle_id COLLATE "C"', proof.releaseId);
  const receipts = await rows(client, select("finance_launch_receipts", 'id COLLATE "C"'), proof.releaseId);
  const deletions = await rows(client, select("finance_deletion_attestations", 'receipt_id COLLATE "C"'), proof.releaseId);
  const mappings = await rows(client, select("finance_candidate_mappings", 'seat_cycle_id COLLATE "C"'), proof.releaseId);
  const committees = await rows(client, select("finance_committee_mappings", 'seat_cycle_id COLLATE "C",committee_id COLLATE "C"'), proof.releaseId);
  const pages = await rows(client, select("finance_page_closures", 'seat_cycle_id COLLATE "C",acquisition_batch COLLATE "C"'), proof.releaseId);
  const amendments = await rows(client, select("finance_amendment_closures", 'seat_cycle_id COLLATE "C",committee_id COLLATE "C",report_type COLLATE "C",reporting_period_start,reporting_period_end'), proof.releaseId);
  const filings = await rows(client, 'SELECT id,seat_cycle_id,committee_id,report_type,reporting_period_start,reporting_period_end,source_filing_id,amendment_number,amendment_status,amends_filing_id,filed_at FROM fec_filing_summaries WHERE release_id=$1 ORDER BY seat_cycle_id COLLATE "C",committee_id COLLATE "C",report_type COLLATE "C",reporting_period_start,reporting_period_end,amendment_number,id COLLATE "C"', proof.releaseId);
  const vacancies = await rows(client, select("vacancy_reviews", 'seat_cycle_id COLLATE "C"'), proof.releaseId);
  const terminals = await rows(client, select("finance_terminal_dispositions", 'seat_cycle_id COLLATE "C"'), proof.releaseId);
  const coverage = await rows(client, select("finance_coverage_closures", 'seat_cycle_id COLLATE "C",kind COLLATE "C"'), proof.releaseId);
  const evidence = evidenceAs<FinanceEvidence>({ profile, receipts, deletions, mappings, committees, pages, amendments, filings, vacancies, terminals, coverage });
  validateFinanceEvidence(evidence, proof);
  await assertLoadedFinanceContent(client, proof.releaseId);
  return { kind: "finance", proof, evidence, digests: await loadDigests(client, proof.releaseId) };
}

export async function verifyFinancePublicationProofWithClient(client: PoolClient, proof: FinancePublicationProof, resolver: PublicKeyResolver, verifier: SignatureVerifier, stores: LaunchArtifactStoreResolver): Promise<string> {
  const payload = await buildFinancePublicationPayloadWithClient(client, proof);
  await verifyLaunchArtifacts(payload.evidence.receipts, true, stores);
  await verifyEvidenceSignatures(payload.evidence, await signatureIndex(client, proof.releaseId), resolver, verifier);
  const canonicalSha = canonicalSha256(payload);
  await verifyStoredPublicationProof(client, "finance_publication_proofs", proof.releaseId, proof.proofId, canonicalSha, resolver, verifier);
  return canonicalSha;
}

export async function buildElectionPublicationPayloadWithClient(client: PoolClient, proof: ElectionPublicationProof): Promise<ElectionCanonicalPayload> {
  if (!electionPublicationProofSchema.safeParse(proof).success) fail("LAUNCH_PROOF_MALFORMED");
  await assertRelease(client, proof.releaseId);
  const decisions = await rows(client, select("election_decisions", 'election_year,id COLLATE "C"'), proof.releaseId);
  const receipts = await rows(client, select("election_launch_receipts", 'id COLLATE "C"'), proof.releaseId);
  const inventory = await rows(client, select("election_inventory_rows", 'election_year,jurisdiction_code COLLATE "C",contest_key COLLATE "C",id COLLATE "C"'), proof.releaseId);
  const authority = await rows(client, select("election_authority_artifacts", 'jurisdiction_code COLLATE "C",election_year,id COLLATE "C"'), proof.releaseId);
  const envelopes = await rows(client, select("election_result_envelopes", 'inventory_row_id COLLATE "C",id COLLATE "C"'), proof.releaseId);
  const resultTotals = await rows(client, 'SELECT envelope_id,option_key,votes FROM election_result_rows WHERE release_id=$1 ORDER BY envelope_id COLLATE "C",option_key COLLATE "C"', proof.releaseId);
  const lineage = await rows(client, select("election_result_receipt_lineage", 'envelope_id COLLATE "C",receipt_id COLLATE "C"'), proof.releaseId);
  const geometry = await rows(client, select("election_geometry_attestations", 'contest_key COLLATE "C"'), proof.releaseId);
  const evidence = evidenceAs<ElectionEvidence>({ decisions, receipts, inventory, authority, envelopes, resultTotals, lineage, geometry });
  validateElectionEvidence(evidence);
  await assertLoadedElectionContent(client, proof.releaseId);
  return { kind: "election", proof, evidence, digests: await loadDigests(client, proof.releaseId) };
}

export async function verifyElectionPublicationProofWithClient(client: PoolClient, proof: ElectionPublicationProof, resolver: PublicKeyResolver, verifier: SignatureVerifier, stores: LaunchArtifactStoreResolver): Promise<string> {
  const payload = await buildElectionPublicationPayloadWithClient(client, proof);
  await verifyLaunchArtifacts(payload.evidence.receipts, false, stores);
  await verifyEvidenceSignatures(payload.evidence, await signatureIndex(client, proof.releaseId), resolver, verifier);
  const canonicalSha = canonicalSha256(payload);
  await verifyStoredPublicationProof(client, "election_publication_proofs", proof.releaseId, proof.proofId, canonicalSha, resolver, verifier);
  return canonicalSha;
}
