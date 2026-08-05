/* eslint-disable @typescript-eslint/no-explicit-any -- every raw parent is byte-pinned before bounded projection */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { aipacEvidenceSchema, type AipacEvidence } from "../../domain/dsa-target-evaluator";
import { validateAipacEvidenceFoundationCandidateV2 } from "./aipac-evidence-foundation-candidate-v2";
import {
  aipacNumericBuildEvidence,
  aipacNumericParsePas2,
  aipacNumericSelectLatestDirect,
  aipacNumericTerminalFilings,
  type AipacNumericDirectRow,
  type AipacNumericEvidenceReceipt,
  type AipacNumericFiling,
  type AipacNumericRelationship,
} from "./aipac-numeric-evidence-candidate";
import { canonicalJson } from "./aipac-proposed-packages";

const CYCLES = [2022, 2024, 2026] as const;
const SHA = z.string().regex(/^[a-f0-9]{64}$/);
const SOURCE_CUTOFF = "2026-08-04" as const;
const PARENT_HASHES = {
  closure: "7b9fd96d102a2367b67e21c969542a9bb2ae5a94a82997ea5baaabdb64d5a15b",
  foundation: "e4e2bfe3818fdbb99bbb0b92671a3419656d38f4d0679eb132a5c17e2b443686",
  projection: "e1c2ab02cafb2ee438ec1a1c936f903e38cc19553d187b6b2d1dca55dc99d3ec",
  roster: "8ae9bb3423e6160d00b5395186c42550e28811b817a482650875d87de71079e1",
  sourceReceipts: "535247ffc7ab9879782ea77d5709b074413589efb774fb91b24a02c2146f88de",
} as const;
const PAS2_HASHES: Readonly<Record<number, string>> = { 2022: "a62d484e952b031d65aa2c712c25268f499c6f333e9e9cfcb40cf378056b30af", 2024: "81520f5d1371f2e89beecd148193e55fdcff7f1dfa6b3a63770e21b928bcbfaf", 2026: "ed0b8a1a498a6633870fe3dd38cd16a6325bcc9aec0102d0cee776cf6a17e240" };
const SEAT_SET_SHA256 = "f81797f604cefdc5fe835757cec66f837708f40ce0030ebcf46aad81451248b1";
const EVIDENCE_SET_SHA256 = "718f175c934ca76f0db8b5ba54ae0376a35067af7a77ee6c1f1d6184da64edfd";
const PACKAGE_SHA256 = "c2e864ee17fe3c264c0a3e49ca2d24bc9fef2498ec998aae90b61920ebaf00ab";
const PENDING_SEATS = ["seat_house_ca_31_current", "seat_house_ma_06_current", "seat_house_md_04_current", "seat_house_mn_03_current", "seat_house_nh_01_current", "seat_house_ny_04_current"] as const;

const coverageDisposition = z.enum(["complete_no_matching_evidence", "complete_matching_evidence", "blocked_pending_mapping", "blocked_invalid_origin", "not_applicable_no_house_candidacy"]);
const coverageCell = z.strictObject({
  cycleYear: z.union([z.literal(2022), z.literal(2024), z.literal(2026)]),
  channel: z.enum(["direct_aipac_pac", "independent_udp"]),
  disposition: coverageDisposition,
  sourceSnapshotIds: z.array(z.string().min(1)).min(1),
  sourceArtifactSha256s: z.array(SHA).min(1),
  basisRelationshipSha256s: z.array(SHA),
  qualifyingEvidenceCount: z.number().int().nonnegative(),
});
const transactionReceipt = z.strictObject({ transactionIdentitySha256: SHA, sourceRecordIdentitySha256s: z.array(SHA).min(1).max(2), corroboration: z.enum(["single_terminal_record", "exact_f24_notice_f3x_non_notice"]) });
const evidenceReceipt = z.strictObject({ evidenceSha256: SHA, transactionReceipts: z.array(transactionReceipt).min(1), selectionRule: z.enum(["pas2_latest_terminal_transaction_revision", "schedule_e_terminal_transaction_or_exact_f24_f3x_corroboration"]) });
const resolutionContext = z.strictObject({
  pendingResolutionSha256s: z.array(SHA),
  invalidOriginDispositionSha256s: z.array(SHA),
  proposedNoHouseCandidacyCycles: z.array(z.union([z.literal(2022), z.literal(2024), z.literal(2026)])),
});
const seat = z.strictObject({
  seatCycleId: z.string().min(1),
  incumbentCandidateId: z.string().regex(/^H[A-Z0-9]{8}$/).nullable(),
  status: z.enum(["complete", "blocked_pending_mapping", "partially_blocked_invalid_origin"]),
  resolutionContext,
  coverage: z.array(coverageCell).length(6),
  evidence: z.array(aipacEvidenceSchema),
  evidenceReceipts: z.array(evidenceReceipt),
  seatSha256: SHA,
});

export const aipacNumericEvidenceCandidateV2Schema = z.strictObject({
  schema: z.literal("aipac-numeric-evidence-candidate-v2"),
  version: z.literal(2),
  generatedAt: z.literal("2026-08-05T19:00:00.000Z"),
  sourceCutoff: z.literal(SOURCE_CUTOFF),
  reviewerOnly: z.literal(true),
  publicationEligible: z.literal(false),
  status: z.literal("automatic_numeric_candidate_with_resolution_firewall"),
  defaultUse: z.literal("use_in_reviewer_only_evaluation_exclude_from_publication"),
  inputs: z.strictObject({
    closureFileSha256: z.literal(PARENT_HASHES.closure), foundationFileSha256: z.literal(PARENT_HASHES.foundation), projectionFileSha256: z.literal(PARENT_HASHES.projection), rosterFileSha256: z.literal(PARENT_HASHES.roster), sourceReceiptsFileSha256: z.literal(PARENT_HASHES.sourceReceipts),
    pas2ZipSha256ByCycle: z.strictObject({ "2022": z.literal(PAS2_HASHES[2022]!), "2024": z.literal(PAS2_HASHES[2024]!), "2026": z.literal(PAS2_HASHES[2026]!) }),
  }),
  policy: z.strictObject({
    cutoffAndAmendments: z.literal("join_every_source_row_to_cutoff_valid_authoritative_filing_chain_before_transaction_selection"),
    transactionIdentity: z.literal("cycle_scoped_transaction_id_latest_terminal_receipt_with_exact_duplicate_validation"),
    signedNetting: z.literal("retain_signed_revisions_and_emit_only_net_positive_relationship_groups"),
    zeroSemantics: z.literal("complete_zero_requires_closed_source_scope_and_no_pending_or_uncovered_invalid_relationship"),
    pendingMappings: z.literal("block_all_six_cells_and_emit_no_evidence_until_authorized_review"),
    invalidOrigins: z.literal("exclude_invalid_relationship_and_block_only_uncovered_channel_cycle_scope"),
    officeChanges: z.literal("record_proposed_no_house_cycle_but_keep_blocked_until_authorized_review"),
    privacy: z.literal("no_names_addresses_employers_occupations_or_free_text"),
  }),
  summary: z.strictObject({ targetSeats: z.literal(212), completeSeats: z.literal(206), blockedPendingSeats: z.literal(6), partiallyBlockedInvalidOriginSeats: z.literal(0), evidenceRows: z.literal(274), directEvidenceRows: z.literal(256), independentEvidenceRows: z.literal(18), seatsWithEvidence: z.literal(124), coverageCells: z.literal(1272), blockedCoverageCells: z.literal(36), notApplicableCoverageCells: z.literal(0) }),
  derivation: z.strictObject({ seatSetSha256: z.literal(SEAT_SET_SHA256), evidenceSetSha256: z.literal(EVIDENCE_SET_SHA256) }),
  seats: z.array(seat).length(212),
  packageSha256: SHA,
});
export type AipacNumericEvidenceCandidateV2 = z.infer<typeof aipacNumericEvidenceCandidateV2Schema>;
export type NumericCandidateV2Paths = Readonly<{ closure: string; foundation: string; projection: string; roster: string; sourceReceipts: string; pas2ZipByCycle: Readonly<Record<number, string>> }>;

const hashBytes = (value: Uint8Array): string => createHash("sha256").update(value).digest("hex");
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");
const bytewise = (a: string, b: string): number => Buffer.compare(Buffer.from(a), Buffer.from(b));
const parseJson = (bytes: Uint8Array): unknown => JSON.parse(Buffer.from(bytes).toString("utf8"));

type ReplacementRelationship = Readonly<{ sourceRelationship: Readonly<{ relationship: "incumbent" | "democratic_primary_challenger"; effectiveCycleYears: readonly number[] }> }>;
export function aipacNumericV2HasSameKindCycleReplacement(rejected: ReplacementRelationship, eligible: readonly ReplacementRelationship[], cycleYear: number): boolean {
  return eligible.some((candidate) => candidate.sourceRelationship.relationship === rejected.sourceRelationship.relationship && candidate.sourceRelationship.effectiveCycleYears.includes(cycleYear));
}
type RejectedOrigin = ReplacementRelationship & Readonly<{ resolution: Readonly<{ kind: "challenger_auto_rejected"; disposition: Readonly<{ cycleYear: number }> }> }>;
export function aipacNumericV2InvalidOriginBlocksScope(channel: "direct_aipac_pac" | "independent_udp", rejected: readonly RejectedOrigin[], eligible: readonly ReplacementRelationship[], cycleYear: number): boolean {
  return channel === "independent_udp" && rejected.some((row) => row.resolution.disposition.cycleYear === cycleYear && !aipacNumericV2HasSameKindCycleReplacement(row, eligible, cycleYear));
}

export function buildAipacNumericEvidenceCandidateV2FromFiles(paths: NumericCandidateV2Paths): AipacNumericEvidenceCandidateV2 {
  const bytes = { closure: readFileSync(paths.closure), foundation: readFileSync(paths.foundation), projection: readFileSync(paths.projection), roster: readFileSync(paths.roster), sourceReceipts: readFileSync(paths.sourceReceipts) };
  for (const [name, expected] of Object.entries(PARENT_HASHES)) if (hashBytes(bytes[name as keyof typeof bytes]) !== expected) throw new Error(`AIPAC_NUMERIC_V2_PARENT_HASH_MISMATCH:${name}`);
  const closure: any = parseJson(bytes.closure), foundation = validateAipacEvidenceFoundationCandidateV2(parseJson(bytes.foundation)), projection: any = parseJson(bytes.projection), roster: any = parseJson(bytes.roster), receipts: any = parseJson(bytes.sourceReceipts);
  const aipacFilings = closure.filingLedgers.find((row: any) => row.committeeId === "C00797670")?.filings as AipacNumericFiling[] | undefined;
  const udpFilings = closure.filingLedgers.find((row: any) => row.committeeId === "C00799031")?.filings as AipacNumericFiling[] | undefined;
  if (!aipacFilings || !udpFilings || closure.sourceCutoff !== SOURCE_CUTOFF || closure.scheduleE.records.length !== 1145) throw new Error("AIPAC_NUMERIC_V2_CLOSURE_INVALID");
  const terminalAipac = aipacNumericTerminalFilings(aipacFilings, "AIPAC_V2"), terminalUdp = aipacNumericTerminalFilings(udpFilings, "UDP_V2");
  const direct: AipacNumericDirectRow[] = [];
  for (const cycle of CYCLES) {
    const zip = readFileSync(paths.pas2ZipByCycle[cycle]!);
    if (hashBytes(zip) !== PAS2_HASHES[cycle]) throw new Error(`AIPAC_NUMERIC_V2_PAS2_HASH_MISMATCH:${cycle}`);
    const text = execFileSync("unzip", ["-p", paths.pas2ZipByCycle[cycle]!, "itpas2.txt"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
    direct.push(...aipacNumericParsePas2(text, cycle, terminalAipac));
  }
  const eligibleRelationships: AipacNumericRelationship[] = foundation.relationships.filter((row) => row.resolution.evaluatorUse === "reviewer_only_candidate").map((row) => ({ ...row.sourceRelationship, evaluatorUse: "reviewer_only_candidate" }));
  const evidenceBySeat = aipacNumericBuildEvidence(aipacNumericSelectLatestDirect(direct), closure.scheduleE.records, eligibleRelationships, terminalUdp, ["aipac-politics", "fec-aipac-pac", "fec-udp"]);
  const rosterIds = new Set(roster.rows.map((row: any) => row.seatCycleId));
  if (projection.seats.length !== 212 || rosterIds.size !== 212 || projection.seats.some((row: any) => !rosterIds.has(row.seatCycleId))) throw new Error("AIPAC_NUMERIC_V2_SEAT_UNIVERSE_MISMATCH");
  const receiptByCycle = new Map(receipts.sources.filter((row: any) => row.channel === "aipac_pac_pas2").map((row: any) => [row.cycleYear, row]));
  const seats: z.infer<typeof seat>[] = projection.seats.map((projectionSeat: any) => {
    const seatId = projectionSeat.seatCycleId as string;
    const wrappers = foundation.relationships.filter((row) => row.sourceRelationship.seatCycleId === seatId);
    const pending = wrappers.filter((row) => row.resolution.kind === "incumbent_pending_authorized_review");
    const invalid = wrappers.filter((row) => row.resolution.kind === "challenger_auto_rejected");
    const eligible = wrappers.filter((row) => row.resolution.evaluatorUse === "reviewer_only_candidate");
    const proposedNoHouseCandidacyCycles = [...new Set(pending.flatMap((row) => row.resolution.kind === "incumbent_pending_authorized_review" ? row.resolution.proposedResolution.cycleDispositions.filter((cycle) => cycle.disposition === "office_changed_to_senate").map((cycle) => cycle.cycleYear) : []))].sort();
    const resolutionContext = { pendingResolutionSha256s: pending.map((row) => row.resolution.kind === "incumbent_pending_authorized_review" ? row.resolution.proposedResolution.resolutionSha256 : "").filter(Boolean).sort(bytewise), invalidOriginDispositionSha256s: invalid.map((row) => row.resolution.kind === "challenger_auto_rejected" ? row.resolution.disposition.dispositionSha256 : "").filter(Boolean).sort(bytewise), proposedNoHouseCandidacyCycles };
    const seatItems = [...(evidenceBySeat.get(seatId) ?? [])].sort((a, b) => a.evidence.cycleYear - b.evidence.cycleYear || bytewise(a.evidence.kind, b.evidence.kind));
    const rawEvidence = seatItems.map((row) => row.evidence), rawReceipts = seatItems.map((row) => row.receipt);
    const coverage = CYCLES.flatMap((cycleYear) => (["direct_aipac_pac", "independent_udp"] as const).map((channel) => {
      const evidenceIndexes = rawEvidence.map((row, index) => ({ row, index })).filter(({ row }) => row.cycleYear === cycleYear && (channel === "direct_aipac_pac" ? row.kind === "direct_contribution" : row.kind !== "direct_contribution"));
      const basis = eligible.filter((row) => channel === "direct_aipac_pac" ? row.sourceRelationship.relationship === "incumbent" && row.sourceRelationship.authorizedCommitteeIdsByCycle.some((cycle) => cycle.cycleYear === cycleYear) : row.sourceRelationship.effectiveCycleYears.includes(cycleYear));
      const invalidScope = aipacNumericV2InvalidOriginBlocksScope(channel, invalid.filter((row): row is typeof row & { resolution: Extract<typeof row.resolution, { kind: "challenger_auto_rejected" }> } => row.resolution.kind === "challenger_auto_rejected"), eligible, cycleYear);
      const disposition = pending.length > 0 ? "blocked_pending_mapping" as const : invalidScope ? "blocked_invalid_origin" as const : evidenceIndexes.length > 0 ? "complete_matching_evidence" as const : "complete_no_matching_evidence" as const;
      const source = receiptByCycle.get(cycleYear) as any;
      return coverageCell.parse({ cycleYear, channel, disposition, sourceSnapshotIds: channel === "direct_aipac_pac" ? [source.id, `aipac-pac-filing-ledger-${cycleYear}`] : [`udp-schedule-e-${cycleYear}-20260804`, `udp-filing-ledger-${cycleYear}`], sourceArtifactSha256s: channel === "direct_aipac_pac" ? [source.sha256, PARENT_HASHES.closure] : [PARENT_HASHES.closure], basisRelationshipSha256s: basis.map((row) => row.relationshipSha256).sort(bytewise), qualifyingEvidenceCount: disposition.startsWith("complete_") ? evidenceIndexes.length : 0 });
    }));
    const blockedPending = pending.length > 0, partiallyBlocked = !blockedPending && coverage.some((cell) => cell.disposition === "blocked_invalid_origin");
    const includedIndexes = new Set<number>();
    for (const cell of coverage) if (cell.disposition === "complete_matching_evidence") rawEvidence.forEach((row, index) => { if (row.cycleYear === cell.cycleYear && (cell.channel === "direct_aipac_pac" ? row.kind === "direct_contribution" : row.kind !== "direct_contribution")) includedIndexes.add(index); });
    const evidence = blockedPending ? [] : rawEvidence.filter((_, index) => includedIndexes.has(index));
    const evidenceReceipts = blockedPending ? [] : rawReceipts.filter((_, index) => includedIndexes.has(index));
    const incumbentCandidateId = eligible.find((row) => row.sourceRelationship.relationship === "incumbent")?.sourceRelationship.candidateId ?? null;
    const unsigned = { seatCycleId: seatId, incumbentCandidateId, status: blockedPending ? "blocked_pending_mapping" as const : partiallyBlocked ? "partially_blocked_invalid_origin" as const : "complete" as const, resolutionContext, coverage, evidence, evidenceReceipts };
    return seat.parse({ ...unsigned, seatSha256: digest("dsa-seats:aipac-numeric-seat:v2\0", unsigned) });
  }).sort((a: z.infer<typeof seat>, b: z.infer<typeof seat>) => bytewise(a.seatCycleId, b.seatCycleId));
  const evidence: AipacEvidence[] = seats.flatMap((row) => row.evidence);
  const unsigned = {
    schema: "aipac-numeric-evidence-candidate-v2" as const, version: 2 as const, generatedAt: "2026-08-05T19:00:00.000Z" as const, sourceCutoff: SOURCE_CUTOFF, reviewerOnly: true as const, publicationEligible: false as const, status: "automatic_numeric_candidate_with_resolution_firewall" as const, defaultUse: "use_in_reviewer_only_evaluation_exclude_from_publication" as const,
    inputs: { closureFileSha256: PARENT_HASHES.closure, foundationFileSha256: PARENT_HASHES.foundation, projectionFileSha256: PARENT_HASHES.projection, rosterFileSha256: PARENT_HASHES.roster, sourceReceiptsFileSha256: PARENT_HASHES.sourceReceipts, pas2ZipSha256ByCycle: { "2022": PAS2_HASHES[2022]!, "2024": PAS2_HASHES[2024]!, "2026": PAS2_HASHES[2026]! } },
    policy: { cutoffAndAmendments: "join_every_source_row_to_cutoff_valid_authoritative_filing_chain_before_transaction_selection" as const, transactionIdentity: "cycle_scoped_transaction_id_latest_terminal_receipt_with_exact_duplicate_validation" as const, signedNetting: "retain_signed_revisions_and_emit_only_net_positive_relationship_groups" as const, zeroSemantics: "complete_zero_requires_closed_source_scope_and_no_pending_or_uncovered_invalid_relationship" as const, pendingMappings: "block_all_six_cells_and_emit_no_evidence_until_authorized_review" as const, invalidOrigins: "exclude_invalid_relationship_and_block_only_uncovered_channel_cycle_scope" as const, officeChanges: "record_proposed_no_house_cycle_but_keep_blocked_until_authorized_review" as const, privacy: "no_names_addresses_employers_occupations_or_free_text" as const },
    summary: { targetSeats: 212 as const, completeSeats: seats.filter((row) => row.status === "complete").length, blockedPendingSeats: seats.filter((row) => row.status === "blocked_pending_mapping").length, partiallyBlockedInvalidOriginSeats: seats.filter((row) => row.status === "partially_blocked_invalid_origin").length, evidenceRows: evidence.length, directEvidenceRows: evidence.filter((row) => row.kind === "direct_contribution").length, independentEvidenceRows: evidence.filter((row) => row.kind !== "direct_contribution").length, seatsWithEvidence: seats.filter((row) => row.evidence.length > 0).length, coverageCells: 1272 as const, blockedCoverageCells: seats.flatMap((row) => row.coverage).filter((cell) => cell.disposition.startsWith("blocked_")).length, notApplicableCoverageCells: seats.flatMap((row) => row.coverage).filter((cell) => cell.disposition === "not_applicable_no_house_candidacy").length },
    derivation: { seatSetSha256: digest("dsa-seats:aipac-numeric-seat-set:v2\0", seats), evidenceSetSha256: digest("dsa-seats:aipac-numeric-evidence-set:v2\0", evidence) }, seats,
  };
  return validateAipacNumericEvidenceCandidateV2({ ...unsigned, packageSha256: digest("dsa-seats:aipac-numeric-evidence-candidate:v2\0", unsigned) });
}

export function validateAipacNumericEvidenceCandidateV2(value: unknown): AipacNumericEvidenceCandidateV2 {
  const parsed = aipacNumericEvidenceCandidateV2Schema.parse(value);
  const { packageSha256, ...unsigned } = parsed;
  if (packageSha256 !== digest("dsa-seats:aipac-numeric-evidence-candidate:v2\0", unsigned)) throw new Error("AIPAC_NUMERIC_V2_PACKAGE_HASH_MISMATCH");
  if (packageSha256 !== PACKAGE_SHA256) throw new Error("AIPAC_NUMERIC_V2_RELEASE_DERIVATION_MISMATCH");
  if (new Set(parsed.seats.map((row) => row.seatCycleId)).size !== 212 || parsed.summary.completeSeats + parsed.summary.blockedPendingSeats + parsed.summary.partiallyBlockedInvalidOriginSeats !== 212) throw new Error("AIPAC_NUMERIC_V2_SEAT_UNIVERSE_MISMATCH");
  for (const row of parsed.seats) {
    const { seatSha256, ...seatUnsigned } = row;
    if (seatSha256 !== digest("dsa-seats:aipac-numeric-seat:v2\0", seatUnsigned)) throw new Error("AIPAC_NUMERIC_V2_SEAT_HASH_MISMATCH");
    const keys = row.coverage.map((cell) => `${cell.cycleYear}:${cell.channel}`);
    if (new Set(keys).size !== 6 || row.evidence.length !== row.evidenceReceipts.length) throw new Error("AIPAC_NUMERIC_V2_COVERAGE_MISMATCH");
    if (row.status === "blocked_pending_mapping" && (row.resolutionContext.pendingResolutionSha256s.length === 0 || row.evidence.length !== 0 || row.coverage.some((cell) => cell.disposition !== "blocked_pending_mapping"))) throw new Error("AIPAC_NUMERIC_V2_PENDING_FALSE_ZERO");
    for (const cycle of row.resolutionContext.proposedNoHouseCandidacyCycles) if (row.coverage.filter((cell) => cell.cycleYear === cycle).some((cell) => cell.disposition === "complete_no_matching_evidence")) throw new Error("AIPAC_NUMERIC_V2_OFFICE_CHANGE_FALSE_ZERO");
    if (row.resolutionContext.invalidOriginDispositionSha256s.length > 0 && row.coverage.some((cell) => cell.disposition === "blocked_invalid_origin") && row.status !== "partially_blocked_invalid_origin") throw new Error("AIPAC_NUMERIC_V2_INVALID_ORIGIN_FALSE_ZERO");
    if (row.status === "complete" && row.coverage.some((cell) => !cell.disposition.startsWith("complete_"))) throw new Error("AIPAC_NUMERIC_V2_COMPLETE_STATE_INVALID");
    const receiptInvalid = row.evidence.some((evidence, index) => {
      const receipt = row.evidenceReceipts[index] as AipacNumericEvidenceReceipt | undefined;
      if (!receipt || receipt.evidenceSha256 !== digest("dsa-seats:aipac-evaluator-evidence:v1\0", evidence) || receipt.selectionRule !== (evidence.kind === "direct_contribution" ? "pas2_latest_terminal_transaction_revision" : "schedule_e_terminal_transaction_or_exact_f24_f3x_corroboration")) return true;
      const tx = receipt.transactionReceipts.map((item) => item.transactionIdentitySha256), sourceRows = receipt.transactionReceipts.flatMap((item) => item.sourceRecordIdentitySha256s);
      if (canonicalJson(tx) !== canonicalJson(evidence.sourceTransactionIdSha256s) || new Set(tx).size !== tx.length || new Set(sourceRows).size !== sourceRows.length) return true;
      return receipt.transactionReceipts.some((item) => evidence.kind === "direct_contribution" ? item.corroboration !== "single_terminal_record" || item.sourceRecordIdentitySha256s.length !== 1 : item.corroboration === "single_terminal_record" ? item.sourceRecordIdentitySha256s.length !== 1 : item.sourceRecordIdentitySha256s.length !== 2);
    });
    if (receiptInvalid) throw new Error("AIPAC_NUMERIC_V2_RECEIPT_MISMATCH");
  }
  const evidence = parsed.seats.flatMap((row) => row.evidence);
  if (parsed.derivation.seatSetSha256 !== digest("dsa-seats:aipac-numeric-seat-set:v2\0", parsed.seats) || parsed.derivation.evidenceSetSha256 !== digest("dsa-seats:aipac-numeric-evidence-set:v2\0", evidence)) throw new Error("AIPAC_NUMERIC_V2_DERIVATION_MISMATCH");
  const blockedSeats = parsed.seats.filter((row) => row.status === "blocked_pending_mapping").map((row) => row.seatCycleId).sort(bytewise);
  if (canonicalJson(blockedSeats) !== canonicalJson([...PENDING_SEATS].sort(bytewise))) throw new Error("AIPAC_NUMERIC_V2_PENDING_SEAT_SET_MISMATCH");
  const ca = parsed.seats.find((row) => row.seatCycleId === "seat_house_ca_47_current"), il = parsed.seats.find((row) => row.seatCycleId === "seat_house_il_07_current");
  if (!ca || ca.status !== "complete" || ca.evidence.length !== 0 || ca.resolutionContext.invalidOriginDispositionSha256s.length !== 1 || !ca.coverage.every((cell) => cell.disposition === "complete_no_matching_evidence")) throw new Error("AIPAC_NUMERIC_V2_CA47_INVALID_ORIGIN_MISMATCH");
  if (!il || il.status !== "complete" || il.evidence.length !== 2 || il.evidence.some((row) => row.kind !== "independent_oppose_challenger") || canonicalJson(il.evidence.map((row) => [row.cycleYear, row.kind === "direct_contribution" ? null : row.targetCandidateId])) !== canonicalJson([[2024, "H0IL07167"], [2026, "H6IL07339"]])) throw new Error("AIPAC_NUMERIC_V2_IL07_EVIDENCE_MISMATCH");
  return parsed;
}
