/* eslint-disable @typescript-eslint/no-explicit-any -- exact parent bytes are hash-pinned before bounded field projection */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { aipacEvidenceSchema, type AipacEvidence } from "../../domain/dsa-target-evaluator";
import { canonicalJson } from "./aipac-proposed-packages";
import { aipacEvidenceFoundationCandidateSchema } from "./aipac-evidence-foundation-candidate";

const CYCLES = [2022, 2024, 2026] as const;
const SHA = z.string().regex(/^[a-f0-9]{64}$/);
const SOURCE_CUTOFF = "2026-08-04" as const;
const PARENT_HASHES = {
  closure: "7b9fd96d102a2367b67e21c969542a9bb2ae5a94a82997ea5baaabdb64d5a15b",
  foundation: "a0fe151080a0958c6cdddc447d50db4044700e31960d37dd2326ea86d6f7a7b7",
  projection: "e1c2ab02cafb2ee438ec1a1c936f903e38cc19553d187b6b2d1dca55dc99d3ec",
  roster: "8ae9bb3423e6160d00b5395186c42550e28811b817a482650875d87de71079e1",
  sourceReceipts: "535247ffc7ab9879782ea77d5709b074413589efb774fb91b24a02c2146f88de",
} as const;
const PAS2_HASHES: Readonly<Record<number, string>> = {
  2022: "a62d484e952b031d65aa2c712c25268f499c6f333e9e9cfcb40cf378056b30af",
  2024: "81520f5d1371f2e89beecd148193e55fdcff7f1dfa6b3a63770e21b928bcbfaf",
  2026: "ed0b8a1a498a6633870fe3dd38cd16a6325bcc9aec0102d0cee776cf6a17e240",
};
const SEAT_SET_SHA256 = "1675bdedddb55d5520b9258f5ffa09d97fe8b19d566d5ea5763d8d66f7c82fb7";
const EVIDENCE_SET_SHA256 = "637232a75e4d517d4c72aaafaf0ea962e728a4e3e19de96851863f74c0f566f3";
const PACKAGE_SHA256 = "dc3f6939701930226ad7558661e14b9912b7828266133d44260ae83570a2c077";

const coverageDisposition = z.enum(["complete_no_matching_evidence", "complete_matching_evidence", "blocked_mapping_review"]);
const coverageCell = z.strictObject({
  cycleYear: z.union([z.literal(2022), z.literal(2024), z.literal(2026)]),
  channel: z.enum(["direct_aipac_pac", "independent_udp"]),
  disposition: coverageDisposition,
  sourceSnapshotIds: z.array(z.string().min(1)).min(1),
  sourceArtifactSha256s: z.array(SHA).min(1),
  qualifyingEvidenceCount: z.number().int().nonnegative(),
});
const evidenceReceipt = z.strictObject({
  evidenceSha256: SHA,
  transactionReceipts: z.array(z.strictObject({ transactionIdentitySha256: SHA, sourceRecordIdentitySha256s: z.array(SHA).min(1).max(2), corroboration: z.enum(["single_terminal_record", "exact_f24_notice_f3x_non_notice"]) })).min(1),
  selectionRule: z.enum(["pas2_latest_terminal_transaction_revision", "schedule_e_terminal_transaction_or_exact_f24_f3x_corroboration"]),
});
const seat = z.strictObject({
  seatCycleId: z.string().min(1),
  incumbentCandidateId: z.string().regex(/^H[A-Z0-9]{8}$/).nullable(),
  status: z.enum(["complete", "blocked_mapping_review"]),
  coverage: z.array(coverageCell).length(6),
  evidence: z.array(aipacEvidenceSchema),
  evidenceReceipts: z.array(evidenceReceipt),
  seatSha256: SHA,
});

export const aipacNumericEvidenceCandidateSchema = z.strictObject({
  schema: z.literal("aipac-numeric-evidence-candidate-v1"),
  version: z.literal(1),
  generatedAt: z.literal("2026-08-05T06:30:00.000Z"),
  sourceCutoff: z.literal(SOURCE_CUTOFF),
  reviewerOnly: z.literal(true),
  publicationEligible: z.literal(false),
  status: z.literal("automatic_numeric_candidate"),
  defaultUse: z.literal("use_in_reviewer_only_evaluation_exclude_from_publication"),
  inputs: z.strictObject({
    closureFileSha256: z.literal(PARENT_HASHES.closure),
    foundationFileSha256: z.literal(PARENT_HASHES.foundation),
    projectionFileSha256: z.literal(PARENT_HASHES.projection),
    rosterFileSha256: z.literal(PARENT_HASHES.roster),
    sourceReceiptsFileSha256: z.literal(PARENT_HASHES.sourceReceipts),
    pas2ZipSha256ByCycle: z.strictObject({ "2022": z.literal(PAS2_HASHES[2022]!), "2024": z.literal(PAS2_HASHES[2024]!), "2026": z.literal(PAS2_HASHES[2026]!) }),
  }),
  policy: z.strictObject({
    cutoffAndAmendments: z.literal("join_every_source_row_to_cutoff_valid_authoritative_filing_chain_before_transaction_selection"),
    transactionIdentity: z.literal("cycle_scoped_transaction_id_latest_terminal_receipt_with_exact_duplicate_validation"),
    signedNetting: z.literal("retain_signed_revisions_and_emit_only_net_positive_relationship_groups"),
    zeroSemantics: z.literal("complete_zero_only_after_six_closed_channel_cycle_cells_and_nonconflicting_mapping"),
    conflicts: z.literal("blocked_mapping_review_never_zero"),
    privacy: z.literal("no_names_addresses_employers_occupations_or_free_text"),
  }),
  summary: z.strictObject({
    targetSeats: z.literal(212),
    completeSeats: z.number().int().nonnegative(),
    blockedSeats: z.number().int().nonnegative(),
    evidenceRows: z.number().int().nonnegative(),
    directEvidenceRows: z.number().int().nonnegative(),
    independentEvidenceRows: z.number().int().nonnegative(),
    seatsWithEvidence: z.number().int().nonnegative(),
    coverageCells: z.literal(1272),
  }),
  derivation: z.strictObject({ seatSetSha256: z.literal(SEAT_SET_SHA256), evidenceSetSha256: z.literal(EVIDENCE_SET_SHA256) }),
  seats: z.array(seat).length(212),
  packageSha256: SHA,
});
export type AipacNumericEvidenceCandidate = z.infer<typeof aipacNumericEvidenceCandidateSchema>;

export type AipacNumericFiling = Readonly<{ cycleYear: number; fileNumber: number; amendmentChain: number[]; receiptDate: string; formType: string }>;
export type AipacNumericRelationship = Pick<z.infer<typeof aipacEvidenceFoundationCandidateSchema>["relationships"][number], "candidateId" | "seatCycleId" | "relationship" | "effectiveCycleYears" | "authorizedCommitteeIdsByCycle" | "evaluatorUse">;
export type AipacNumericDirectRow = Readonly<{ cycleYear: number; fileNumber: number; receiptDate: string; transactionIdSha256: string; sourceRecordIdentitySha256: string; transactionType: string; transactionPgi: string; transactionDate: string; amountCents: bigint; recipientCommitteeId: string; candidateId: string; memoCode: string | null }>;
export type AipacNumericEvidenceReceipt = z.infer<typeof evidenceReceipt>;
export type AipacNumericEvidenceWithReceipt = Readonly<{ evidence: AipacEvidence; receipt: AipacNumericEvidenceReceipt }>;
type TransactionReceipt = AipacNumericEvidenceReceipt["transactionReceipts"][number];

const hashBytes = (value: Uint8Array): string => createHash("sha256").update(value).digest("hex");
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");
const bytewise = (a: string, b: string): number => Buffer.compare(Buffer.from(a), Buffer.from(b));
const parseJson = (bytes: Uint8Array): unknown => JSON.parse(Buffer.from(bytes).toString("utf8"));
const date = (raw: string): string => {
  const match = /^(\d{2})(\d{2})(\d{4})$/.exec(raw);
  if (!match) throw new Error("AIPAC_NUMERIC_PAS2_DATE_INVALID");
  const value = `${match[3]}-${match[1]}-${match[2]}`;
  if (new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) throw new Error("AIPAC_NUMERIC_PAS2_DATE_INVALID");
  return value;
};
const cents = (raw: string): bigint => {
  const match = /^(-?)(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(raw);
  if (!match) throw new Error("AIPAC_NUMERIC_PAS2_AMOUNT_INVALID");
  return BigInt(`${match[1]}${match[2]}${(match[3] ?? "").padEnd(2, "0")}`);
};
const dollars = (value: bigint): number => Number(value) / 100;

export function aipacNumericTerminalFilings(rows: readonly AipacNumericFiling[], committee: string): Map<number, AipacNumericFiling> {
  const byFile = new Map(rows.map((row) => [row.fileNumber, row]));
  if (byFile.size !== rows.length) throw new Error(`AIPAC_NUMERIC_${committee}_LEDGER_DUPLICATE`);
  const superseded = new Set<number>();
  for (const row of rows) {
    if (row.receiptDate > SOURCE_CUTOFF || row.amendmentChain.length === 0 || row.amendmentChain.at(-1) !== row.fileNumber || new Set(row.amendmentChain).size !== row.amendmentChain.length) throw new Error(`AIPAC_NUMERIC_${committee}_LEDGER_INVALID`);
    for (const predecessor of row.amendmentChain.slice(0, -1)) {
      if (!byFile.has(predecessor)) throw new Error(`AIPAC_NUMERIC_${committee}_LEDGER_PREDECESSOR_MISSING`);
      superseded.add(predecessor);
    }
  }
  return new Map(rows.filter((row) => !superseded.has(row.fileNumber)).map((row) => [row.fileNumber, row]));
}

export function aipacNumericParsePas2(text: string, cycleYear: number, terminal: Map<number, AipacNumericFiling>): AipacNumericDirectRow[] {
  const rows: AipacNumericDirectRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const f = line.split("|");
    if (f.length !== 22) throw new Error("AIPAC_NUMERIC_PAS2_WIDTH_INVALID");
    if (f[0] !== "C00797670") continue;
    const fileNumber = Number(f[18]);
    const filing = terminal.get(fileNumber);
    if (!filing) continue;
    if (filing.cycleYear !== cycleYear) throw new Error("AIPAC_NUMERIC_PAS2_LEDGER_CYCLE_MISMATCH");
    if (!/^P\d{4}$/.test(f[3]!) || !["24K", "24P", "24Z"].includes(f[5]!) || f[19] === "X" || f[14] === "0" || f[14] === "0.00") continue;
    if (!f[15] || !f[16] || !f[17] || !f[21]) continue;
    const transactionIdSha256 = digest("dsa-seats:pas2-transaction-id:v1\0", f[17]), subIdSha256 = digest("dsa-seats:pas2-sub-id:v1\0", f[21]);
    rows.push({ cycleYear, fileNumber, receiptDate: filing.receiptDate, transactionIdSha256, sourceRecordIdentitySha256: digest("dsa-seats:pas2-source-record:v1\0", { cycleYear, fileNumber, transactionIdSha256, subIdSha256, transactionType: f[5], transactionPgi: f[3], transactionDate: f[13], amount: f[14], recipientCommitteeId: f[15], candidateId: f[16], memoCode: f[19] || null }), transactionType: f[5]!, transactionPgi: f[3]!, transactionDate: date(f[13]!), amountCents: cents(f[14]!), recipientCommitteeId: f[15]!, candidateId: f[16]!, memoCode: f[19] || null });
  }
  return rows;
}

export function aipacNumericSelectLatestDirect(rows: readonly AipacNumericDirectRow[]): AipacNumericDirectRow[] {
  const groups = new Map<string, AipacNumericDirectRow[]>();
  for (const row of rows) { const key = `${row.cycleYear}:${row.transactionIdSha256}`; groups.set(key, [...(groups.get(key) ?? []), row]); }
  return [...groups.values()].map((group) => {
    const latestReceipt = group.map((row) => row.receiptDate).sort().at(-1)!;
    const latestFile = Math.max(...group.filter((row) => row.receiptDate === latestReceipt).map((row) => row.fileNumber));
    const latest = group.filter((row) => row.receiptDate === latestReceipt && row.fileNumber === latestFile);
    const economic = new Set(latest.map((row) => canonicalJson({ pgi: row.transactionPgi, type: row.transactionType, date: row.transactionDate, amount: row.amountCents.toString(), recipient: row.recipientCommitteeId, candidate: row.candidateId, memo: row.memoCode })));
    if (economic.size !== 1) throw new Error("AIPAC_NUMERIC_PAS2_LATEST_IDENTITY_CONFLICT");
    if (latest.length !== 1) throw new Error("AIPAC_NUMERIC_PAS2_LINE_IDENTITY_AMBIGUOUS");
    return latest[0]!;
  });
}

export function aipacNumericSelectUniqueUdpRows(schedule: readonly any[], terminalUdp: Map<number, AipacNumericFiling>): { record: any; sourceRecordIdentitySha256s: string[] }[] {
  const terminalRows = schedule.filter((row) => terminalUdp.has(row.fileNumber) && row.candidateId && row.electionType === `P${row.cycleYear}` && !row.memoedSubtotal && row.memoCode !== "X");
  const txGroups = new Map<string, any[]>();
  for (const row of terminalRows) { const key = `${row.cycleYear}:${row.transactionIdSha256}`; txGroups.set(key, [...(txGroups.get(key) ?? []), row]); }
  return [...txGroups.values()].map((group) => {
    const economic = new Set(group.map((row) => canonicalJson({ candidateId: row.candidateId, electionType: row.electionType, supportOppose: row.supportOppose, amount: row.amount, expenditureDate: row.expenditureDate })));
    if (economic.size !== 1) throw new Error("AIPAC_NUMERIC_UDP_TRANSACTION_CONFLICT");
    const forms = [...new Set(group.map((row) => row.filingForm))].sort();
    if (group.length > 1 && (group.length !== 2 || canonicalJson(forms) !== canonicalJson(["F24", "F3X"]))) throw new Error("AIPAC_NUMERIC_UDP_LINE_IDENTITY_AMBIGUOUS");
    if (group.length === 2 && (!group.some((row) => row.filingForm === "F24" && row.isNotice === true) || !group.some((row) => row.filingForm === "F3X" && row.isNotice === false) || new Set(group.map((row) => row.recordIdentitySha256)).size !== 2)) throw new Error("AIPAC_NUMERIC_UDP_CORROBORATION_INVALID");
    return { record: [...group].sort((a, b) => Number(a.isNotice) - Number(b.isNotice) || b.filingDate.localeCompare(a.filingDate) || b.fileNumber - a.fileNumber)[0]!, sourceRecordIdentitySha256s: group.map((row) => row.recordIdentitySha256).sort(bytewise) };
  });
}

export function aipacNumericBuildEvidence(direct: readonly AipacNumericDirectRow[], schedule: readonly any[], relationships: readonly AipacNumericRelationship[], terminalUdp: Map<number, AipacNumericFiling>, classificationSnapshots: readonly string[]): Map<string, AipacNumericEvidenceWithReceipt[]> {
  const result = new Map<string, AipacNumericEvidenceWithReceipt[]>();
  const usable = relationships.filter((row) => row.evaluatorUse === "reviewer_only_candidate");
  const add = (seatId: string, evidence: AipacEvidence, transactionReceipts: TransactionReceipt[], selectionRule: z.infer<typeof evidenceReceipt>["selectionRule"]) => result.set(seatId, [...(result.get(seatId) ?? []), { evidence, receipt: evidenceReceipt.parse({ evidenceSha256: digest("dsa-seats:aipac-evaluator-evidence:v1\0", evidence), transactionReceipts: [...transactionReceipts].sort((a, b) => bytewise(a.transactionIdentitySha256, b.transactionIdentitySha256)), selectionRule }) }]);
  for (const relation of usable.filter((row) => row.relationship === "incumbent")) {
    for (const cycle of relation.authorizedCommitteeIdsByCycle) {
      const selected = direct.filter((row) => row.cycleYear === cycle.cycleYear && row.candidateId === relation.candidateId && cycle.committeeIds.includes(row.recipientCommitteeId));
      const amount = selected.reduce((sum, row) => sum + row.amountCents, BigInt(0));
      if (amount <= BigInt(0)) continue;
      const evidence = aipacEvidenceSchema.parse({ kind: "direct_contribution", committeeId: "C00797670", recipientCommitteeId: [...new Set(selected.map((row) => row.recipientCommitteeId))].sort(bytewise).join(","), recipientCandidateId: relation.candidateId, recipientRelationship: "authorized", netAmount: dollars(amount), cycleYear: cycle.cycleYear, observedAt: selected.map((row) => row.receiptDate).sort().at(-1)!, inputSnapshotIds: [`fec-pas2-${cycle.cycleYear}-20260804`, `aipac-pac-filing-ledger-${cycle.cycleYear}`], sourceTransactionIdSha256s: selected.map((row) => row.transactionIdSha256).sort(bytewise), latestRevisionFileNumber: Math.max(...selected.map((row) => row.fileNumber)), revisionStatus: "latest_net_positive" });
      add(relation.seatCycleId, evidence, selected.map((row) => ({ transactionIdentitySha256: row.transactionIdSha256, sourceRecordIdentitySha256s: [row.sourceRecordIdentitySha256], corroboration: "single_terminal_record" as const })), "pas2_latest_terminal_transaction_revision");
    }
  }
  const uniqueUdp = aipacNumericSelectUniqueUdpRows(schedule, terminalUdp);
  for (const relation of usable) {
    for (const cycleYear of relation.effectiveCycleYears) {
      const direction = relation.relationship === "incumbent" ? "S" : "O";
      const selected = uniqueUdp.filter(({ record }) => record.cycleYear === cycleYear && record.candidateId === relation.candidateId && record.supportOppose === direction);
      const amount = selected.reduce((sum, { record }) => sum + BigInt(Math.round(record.amount * 100)), BigInt(0));
      if (amount <= BigInt(0)) continue;
      const kind = relation.relationship === "incumbent" ? "independent_support_incumbent" : "independent_oppose_challenger";
      const evidence = aipacEvidenceSchema.parse({ kind, committeeId: "C00799031", targetCandidateId: relation.candidateId, targetSeatCycleId: relation.seatCycleId, electionType: "primary", supportOppose: direction, targetRelationship: relation.relationship, networkClassificationId: "org-classification-aipac-network-v1", classificationSnapshotIds: classificationSnapshots, netAmount: dollars(amount), cycleYear, observedAt: selected.map(({ record }) => terminalUdp.get(record.fileNumber)!.receiptDate).sort().at(-1)!, inputSnapshotIds: [`udp-schedule-e-${cycleYear}-20260804`, `udp-filing-ledger-${cycleYear}`], sourceTransactionIdSha256s: selected.map(({ record }) => record.transactionIdSha256).sort(bytewise), latestRevisionFileNumber: Math.max(...selected.map(({ record }) => record.fileNumber)), revisionStatus: "latest_net_positive" });
      add(relation.seatCycleId, evidence, selected.map(({ record, sourceRecordIdentitySha256s }) => ({ transactionIdentitySha256: record.transactionIdSha256, sourceRecordIdentitySha256s, corroboration: sourceRecordIdentitySha256s.length === 2 ? "exact_f24_notice_f3x_non_notice" as const : "single_terminal_record" as const })), "schedule_e_terminal_transaction_or_exact_f24_f3x_corroboration");
    }
  }
  return result;
}

export const aipacNumericEvidenceCandidateTestHooks = { selectLatestDirect: aipacNumericSelectLatestDirect, selectUniqueUdpRows: aipacNumericSelectUniqueUdpRows };

export type NumericCandidatePaths = Readonly<{ closure: string; foundation: string; projection: string; roster: string; sourceReceipts: string; pas2ZipByCycle: Readonly<Record<number, string>> }>;

export function buildAipacNumericEvidenceCandidateFromFiles(paths: NumericCandidatePaths): AipacNumericEvidenceCandidate {
  const bytes = { closure: readFileSync(paths.closure), foundation: readFileSync(paths.foundation), projection: readFileSync(paths.projection), roster: readFileSync(paths.roster), sourceReceipts: readFileSync(paths.sourceReceipts) };
  for (const [name, expected] of Object.entries(PARENT_HASHES)) if (hashBytes(bytes[name as keyof typeof bytes]) !== expected) throw new Error(`AIPAC_NUMERIC_PARENT_HASH_MISMATCH:${name}`);
  const closure: any = parseJson(bytes.closure), foundation = aipacEvidenceFoundationCandidateSchema.parse(parseJson(bytes.foundation)), projection: any = parseJson(bytes.projection), roster: any = parseJson(bytes.roster), receipts: any = parseJson(bytes.sourceReceipts);
  const aipacFilings = closure.filingLedgers.find((row: any) => row.committeeId === "C00797670")?.filings as AipacNumericFiling[] | undefined;
  const udpFilings = closure.filingLedgers.find((row: any) => row.committeeId === "C00799031")?.filings as AipacNumericFiling[] | undefined;
  if (!aipacFilings || !udpFilings || closure.sourceCutoff !== SOURCE_CUTOFF || closure.scheduleE.records.length !== 1145) throw new Error("AIPAC_NUMERIC_CLOSURE_INVALID");
  const terminalAipac = aipacNumericTerminalFilings(aipacFilings, "AIPAC"), terminalUdp = aipacNumericTerminalFilings(udpFilings, "UDP");
  const direct: AipacNumericDirectRow[] = [];
  for (const cycle of CYCLES) {
    const zip = readFileSync(paths.pas2ZipByCycle[cycle]!);
    if (hashBytes(zip) !== PAS2_HASHES[cycle]) throw new Error(`AIPAC_NUMERIC_PAS2_HASH_MISMATCH:${cycle}`);
    const text = execFileSync("unzip", ["-p", paths.pas2ZipByCycle[cycle]!, "itpas2.txt"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
    direct.push(...aipacNumericParsePas2(text, cycle, terminalAipac));
  }
  const latestDirect = aipacNumericSelectLatestDirect(direct);
  const classificationSnapshots = ["aipac-politics", "fec-aipac-pac", "fec-udp"];
  const evidenceBySeat = aipacNumericBuildEvidence(latestDirect, closure.scheduleE.records, foundation.relationships, terminalUdp, classificationSnapshots);
  const rosterIds = new Set(roster.rows.map((row: any) => row.seatCycleId));
  if (projection.seats.length !== 212 || rosterIds.size !== 212 || projection.seats.some((row: any) => !rosterIds.has(row.seatCycleId))) throw new Error("AIPAC_NUMERIC_SEAT_UNIVERSE_MISMATCH");
  const conflictSeats = new Set(foundation.relationships.filter((row) => row.evaluatorUse === "excluded_conflict").map((row) => row.seatCycleId));
  const receiptByCycle = new Map(receipts.sources.filter((row: any) => row.channel === "aipac_pac_pas2").map((row: any) => [row.cycleYear, row]));
  const scheduleHash = PARENT_HASHES.closure;
  const seats: z.infer<typeof seat>[] = projection.seats.map((projectionSeat: any) => {
    const seatItems = [...(evidenceBySeat.get(projectionSeat.seatCycleId) ?? [])].sort((a, b) => a.evidence.cycleYear - b.evidence.cycleYear || bytewise(a.evidence.kind, b.evidence.kind));
    const seatEvidence = seatItems.map((row) => row.evidence), seatReceipts = seatItems.map((row) => row.receipt);
    const blocked = conflictSeats.has(projectionSeat.seatCycleId);
    const incumbent = foundation.relationships.find((row) => row.seatCycleId === projectionSeat.seatCycleId && row.relationship === "incumbent" && row.evaluatorUse === "reviewer_only_candidate")?.candidateId ?? null;
    const coverage = CYCLES.flatMap((cycleYear) => (["direct_aipac_pac", "independent_udp"] as const).map((channel) => {
      const count = seatEvidence.filter((row) => row.cycleYear === cycleYear && (channel === "direct_aipac_pac" ? row.kind === "direct_contribution" : row.kind !== "direct_contribution")).length;
      const source = receiptByCycle.get(cycleYear) as any;
      return coverageCell.parse({ cycleYear, channel, disposition: blocked ? "blocked_mapping_review" : count ? "complete_matching_evidence" : "complete_no_matching_evidence", sourceSnapshotIds: channel === "direct_aipac_pac" ? [source.id, `aipac-pac-filing-ledger-${cycleYear}`] : [`udp-schedule-e-${cycleYear}-20260804`, `udp-filing-ledger-${cycleYear}`], sourceArtifactSha256s: channel === "direct_aipac_pac" ? [source.sha256, PARENT_HASHES.closure] : [scheduleHash], qualifyingEvidenceCount: count });
    }));
    const unsigned = { seatCycleId: projectionSeat.seatCycleId, incumbentCandidateId: incumbent, status: blocked ? "blocked_mapping_review" as const : "complete" as const, coverage, evidence: blocked ? [] : seatEvidence, evidenceReceipts: blocked ? [] : seatReceipts };
    return seat.parse({ ...unsigned, seatSha256: digest("dsa-seats:aipac-numeric-seat:v1\0", unsigned) });
  }).sort((a: z.infer<typeof seat>, b: z.infer<typeof seat>) => bytewise(a.seatCycleId, b.seatCycleId));
  const evidence: AipacEvidence[] = seats.flatMap((row) => row.evidence);
  const unsigned = {
    schema: "aipac-numeric-evidence-candidate-v1" as const, version: 1 as const, generatedAt: "2026-08-05T06:30:00.000Z" as const, sourceCutoff: SOURCE_CUTOFF, reviewerOnly: true as const, publicationEligible: false as const, status: "automatic_numeric_candidate" as const, defaultUse: "use_in_reviewer_only_evaluation_exclude_from_publication" as const,
    inputs: { closureFileSha256: PARENT_HASHES.closure, foundationFileSha256: PARENT_HASHES.foundation, projectionFileSha256: PARENT_HASHES.projection, rosterFileSha256: PARENT_HASHES.roster, sourceReceiptsFileSha256: PARENT_HASHES.sourceReceipts, pas2ZipSha256ByCycle: { "2022": PAS2_HASHES[2022]!, "2024": PAS2_HASHES[2024]!, "2026": PAS2_HASHES[2026]! } },
    policy: { cutoffAndAmendments: "join_every_source_row_to_cutoff_valid_authoritative_filing_chain_before_transaction_selection" as const, transactionIdentity: "cycle_scoped_transaction_id_latest_terminal_receipt_with_exact_duplicate_validation" as const, signedNetting: "retain_signed_revisions_and_emit_only_net_positive_relationship_groups" as const, zeroSemantics: "complete_zero_only_after_six_closed_channel_cycle_cells_and_nonconflicting_mapping" as const, conflicts: "blocked_mapping_review_never_zero" as const, privacy: "no_names_addresses_employers_occupations_or_free_text" as const },
    summary: { targetSeats: 212 as const, completeSeats: seats.filter((row) => row.status === "complete").length, blockedSeats: seats.filter((row) => row.status === "blocked_mapping_review").length, evidenceRows: evidence.length, directEvidenceRows: evidence.filter((row) => row.kind === "direct_contribution").length, independentEvidenceRows: evidence.filter((row) => row.kind !== "direct_contribution").length, seatsWithEvidence: seats.filter((row) => row.evidence.length > 0).length, coverageCells: 1272 as const },
    derivation: { seatSetSha256: digest("dsa-seats:aipac-numeric-seat-set:v1\0", seats), evidenceSetSha256: digest("dsa-seats:aipac-numeric-evidence-set:v1\0", evidence) }, seats,
  };
  return validateAipacNumericEvidenceCandidate({ ...unsigned, packageSha256: digest("dsa-seats:aipac-numeric-evidence-candidate:v1\0", unsigned) });
}

export function validateAipacNumericEvidenceCandidate(value: unknown): AipacNumericEvidenceCandidate {
  const parsed = aipacNumericEvidenceCandidateSchema.parse(value);
  const { packageSha256, ...unsigned } = parsed;
  if (packageSha256 !== digest("dsa-seats:aipac-numeric-evidence-candidate:v1\0", unsigned)) throw new Error("AIPAC_NUMERIC_PACKAGE_HASH_MISMATCH");
  if (packageSha256 !== PACKAGE_SHA256) throw new Error("AIPAC_NUMERIC_RELEASE_DERIVATION_MISMATCH");
  if (new Set(parsed.seats.map((row) => row.seatCycleId)).size !== 212 || parsed.summary.completeSeats + parsed.summary.blockedSeats !== 212) throw new Error("AIPAC_NUMERIC_SEAT_UNIVERSE_MISMATCH");
  for (const row of parsed.seats) {
    const { seatSha256, ...seatUnsigned } = row;
    if (seatSha256 !== digest("dsa-seats:aipac-numeric-seat:v1\0", seatUnsigned)) throw new Error("AIPAC_NUMERIC_SEAT_HASH_MISMATCH");
    const keys = row.coverage.map((cell) => `${cell.cycleYear}:${cell.channel}`);
    const receiptInvalid = row.evidence.some((evidence, index) => {
      const receipt = row.evidenceReceipts[index];
      if (!receipt || receipt.evidenceSha256 !== digest("dsa-seats:aipac-evaluator-evidence:v1\0", evidence) || receipt.selectionRule !== (evidence.kind === "direct_contribution" ? "pas2_latest_terminal_transaction_revision" : "schedule_e_terminal_transaction_or_exact_f24_f3x_corroboration")) return true;
      const tx = receipt.transactionReceipts.map((item) => item.transactionIdentitySha256), sourceRows = receipt.transactionReceipts.flatMap((item) => item.sourceRecordIdentitySha256s);
      if (canonicalJson(tx) !== canonicalJson(evidence.sourceTransactionIdSha256s) || new Set(tx).size !== tx.length || new Set(sourceRows).size !== sourceRows.length) return true;
      return receipt.transactionReceipts.some((item) => evidence.kind === "direct_contribution" ? item.corroboration !== "single_terminal_record" || item.sourceRecordIdentitySha256s.length !== 1 : item.corroboration === "single_terminal_record" ? item.sourceRecordIdentitySha256s.length !== 1 : item.sourceRecordIdentitySha256s.length !== 2);
    });
    if (new Set(keys).size !== 6 || row.evidence.length !== row.evidenceReceipts.length || receiptInvalid || row.status === "blocked_mapping_review" && (row.evidence.length !== 0 || row.evidenceReceipts.length !== 0 || row.coverage.some((cell) => cell.disposition !== "blocked_mapping_review"))) throw new Error("AIPAC_NUMERIC_COVERAGE_MISMATCH");
  }
  const evidence = parsed.seats.flatMap((row) => row.evidence);
  if (parsed.derivation.seatSetSha256 !== digest("dsa-seats:aipac-numeric-seat-set:v1\0", parsed.seats) || parsed.derivation.evidenceSetSha256 !== digest("dsa-seats:aipac-numeric-evidence-set:v1\0", evidence)) throw new Error("AIPAC_NUMERIC_DERIVATION_MISMATCH");
  const direct = evidence.filter((row) => row.kind === "direct_contribution").length, independent = evidence.length - direct;
  if (parsed.summary.completeSeats !== 204 || parsed.summary.blockedSeats !== 8 || parsed.summary.evidenceRows !== evidence.length || parsed.summary.directEvidenceRows !== direct || parsed.summary.independentEvidenceRows !== independent || parsed.summary.seatsWithEvidence !== parsed.seats.filter((row) => row.evidence.length > 0).length) throw new Error("AIPAC_NUMERIC_SUMMARY_MISMATCH");
  return parsed;
}
