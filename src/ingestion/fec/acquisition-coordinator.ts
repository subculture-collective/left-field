import { createHash } from "node:crypto";
import { buildFecV2ArtifactTranscriptFromCanonicalBytes, type FecV2ArtifactDescriptor, type FecV2ArtifactTranscript } from "@/db/launch-data-proofs";
import type { FecAcquisitionPlanV2 } from "./acquisition-plan";
import { enumerateNationwideFecFilings, type FecEnumeratorOptions, type FecEnumeratorResult, type FecPageArtifact } from "./fec-enumerator";
import { isValidatedFecEfoLayout, type FecEfoLayout } from "./efo-layout";
import { FecV2RunBudget, type FecV2Dependencies } from "./fetch-client-v2";
import { FecV2AcquisitionPersistence, FecV2ReplayVerifierPersistence, type FecV2ReceiptDescriptor } from "./persistence-v2";
import { decodeFecV2RunDescriptor, fecV2AcquisitionTranscriptSha256, fecV2RunDescriptorSha256, type FecV2AcquisitionTranscriptReceipt } from "./run-descriptor";
import { acquireAndStoreFecV2SanitizedFiling, FecSanitizedFilingAcquisitionError } from "./sanitized-filing-acquisition";
import { FecV2LineageSpool } from "./lineage-spool";
import type { VersionedArtifactReceipt, VersionedRawObjectStore, VersionedStoreActivation } from "./versioned-artifact-store";

type Core = Readonly<{ plan: FecAcquisitionPlanV2; planSha256: string; apiKey: string; store: VersionedRawObjectStore; activation: VersionedStoreActivation; acquisition: FecV2AcquisitionPersistence; verifier: FecV2ReplayVerifierPersistence; runId: string; snapshotId: string; signal: AbortSignal; deadlineMs: number; layout: FecEfoLayout }>;
type Enumerator = (options: FecEnumeratorOptions) => Promise<FecEnumeratorResult>;
type Acquirer = typeof acquireAndStoreFecV2SanitizedFiling;
export type FecV2CoordinatorTestingDeps = Readonly<{ enumerate?: Enumerator; acquire?: Acquirer; dependencies?: FecV2Dependencies; now?: () => number; lineageSpool?: Readonly<{ tempRoot?: string; maxRows?: number; maxBytes?: number; maxLineBytes?: number }> }>;

const sha = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const instant = (now: () => number): string => new Date(now()).toISOString();
const receiptId = (plan: string, kind: string, artifact: string, version: string): string => `fecv2r_${sha(Buffer.from(`${plan}\0${kind}\0${artifact}\0${version}`)).slice(0, 40)}`;
const bytewise = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));
/** Scope and semantic annotations are not Task7 decoded evidence. */
export const fecV2DecodedEvidenceSha256 = (artifact: ReturnType<typeof buildFecV2ArtifactTranscriptFromCanonicalBytes>, canonicalBytes: Uint8Array): string => {
  if (artifact.artifactKind !== "sanitized_filing") return sha(canonicalBytes);
  const candidateIds = [...new Set(artifact.decoded.candidateIds)].sort(bytewise);
  const value = { fileNumber: artifact.decoded.fileNumber, ledgerIdentitySha256: artifact.decoded.ledgerIdentitySha256, reportDate: artifact.decoded.reportDate, candidateIds };
  return sha(Buffer.from(`${JSON.stringify(value)}\n`));
};
const live = (x: Core): void => { if (x.signal.aborted) throw new Error("FEC_V2_ABORTED"); if (!Number.isSafeInteger(x.deadlineMs) || Date.now() >= x.deadlineMs) throw new Error("FEC_V2_DEADLINE"); };
const descriptor = (x: FecV2ReceiptDescriptor, planSha256: string): FecV2ArtifactDescriptor => ({ receiptId: x.receiptId, objectKey: x.objectKey, versionId: x.versionId, etag: x.etag, artifactSha256: x.artifactSha256, byteSize: String(x.byteSize), artifactKind: x.artifactKind, upstreamEntitySha256: x.upstreamEntitySha256, retrievedAt: x.retrievedAt instanceof Date ? x.retrievedAt.toISOString() : x.retrievedAt, snapshotId: x.snapshotId, planSha256 });
const receipt = (stored: VersionedArtifactReceipt, id: string, kind: FecV2ReceiptDescriptor["artifactKind"], artifactSha256: string, size: number, snapshotId: string, upstream: string | null, at: string): FecV2ReceiptDescriptor => ({ receiptId: id, artifactSha256, artifactKind: kind, canonicalByteSize: size, upstreamEntitySha256: upstream, objectKey: stored.objectKey, versionId: stored.versionId, etag: stored.etag, byteSize: stored.byteSize, retrievedAt: at, snapshotId });
type Replay = Readonly<{ sha256: string; artifacts: ReadonlyMap<string, FecV2ArtifactTranscript> }>;
const MAX_REPLAY_RECEIPTS = 100_000, MAX_DESCRIPTOR_TEXT = 2048;
const validReplayDescriptors = (values: readonly FecV2ReceiptDescriptor[]): boolean => values.length <= MAX_REPLAY_RECEIPTS && values.every((value, index) =>
  [value.receiptId, value.artifactSha256, value.objectKey, value.versionId, value.etag, value.snapshotId, value.retrievedAt instanceof Date ? value.retrievedAt.toISOString() : value.retrievedAt].every(text => typeof text === "string" && text.length > 0 && text.length <= MAX_DESCRIPTOR_TEXT) &&
  Number.isSafeInteger(value.byteSize) && value.byteSize > 0 && Number.isSafeInteger(value.canonicalByteSize) && value.canonicalByteSize > 0 &&
  (index === 0 || bytewise(values[index - 1]!.receiptId, value.receiptId) < 0));
/** The transcript is deliberately retained: graph parity is a second, independent proof. */
async function replay(x: Core, values: readonly FecV2ReceiptDescriptor[]): Promise<Replay> {
  if (!validReplayDescriptors(values)) throw new Error("FEC_V2_REPLAY_RECEIPT_LIMIT");
  const rows: FecV2AcquisitionTranscriptReceipt[] = [];
  const artifacts = new Map<string, FecV2ArtifactTranscript>();
  for (const value of values) {
    live(x); const d = descriptor(value, x.planSha256);
    const { bytes, context } = await x.store.readPersistedExactVersion({ plan: x.planSha256, kind: value.artifactKind, hash: value.artifactSha256, key: value.objectKey, version: value.versionId, etag: value.etag, size: value.byteSize }, { activation: x.activation, signal: x.signal, deadlineMs: x.deadlineMs });
    if (context.kind !== value.artifactKind || bytes.byteLength !== value.byteSize || bytes.byteLength !== value.canonicalByteSize || sha(bytes) !== value.artifactSha256) throw new Error("FEC_V2_RECEIPT_DESCRIPTOR_INVALID");
    const t = buildFecV2ArtifactTranscriptFromCanonicalBytes(d, bytes, { signal: x.signal, deadlineMs: x.deadlineMs, targetCandidateIds: [] });
    if (artifacts.has(value.artifactSha256)) throw new Error("FEC_V2_GRAPH_PARITY_INVALID");
    artifacts.set(value.artifactSha256, t);
    rows.push({ receiptId: value.receiptId, artifactKind: value.artifactKind, artifactSha256: value.artifactSha256, replaySha256: t.replaySha256, replayByteSize: t.replayByteSize, canonicalSchema: t.canonicalSchema, canonicalDecodeVersion: t.canonicalDecodeVersion, decodedEvidenceSha256: fecV2DecodedEvidenceSha256(t, bytes) });
  }
  return Object.freeze({ sha256: fecV2AcquisitionTranscriptSha256({ schemaVersion: 1, transcriptVersion: "fec-v2-acquisition-transcript-v1", receipts: rows }, { signal: x.signal, deadlineMs: x.deadlineMs }), artifacts });
}

async function coordinate(x: Core, testing?: FecV2CoordinatorTestingDeps): Promise<string> {
  const controller = new AbortController(); x.signal.addEventListener("abort", () => controller.abort(x.signal.reason), { once: true }); x = { ...x, signal: controller.signal };
  if (!isValidatedFecEfoLayout(x.layout)) throw new Error("FEC_V2_LAYOUT_INVALID"); live(x);
  const now = testing?.now ?? Date.now, budget = new FecV2RunBudget({ signal: x.signal, deadline: x.deadlineMs }), spool = await FecV2LineageSpool.create(testing?.lineageSpool);
  try {
    await x.acquisition.stageSnapshot({ snapshotId: x.snapshotId, originReleaseId: x.plan.releaseId, sourceId: "src_fec", sourceUrl: "https://api.open.fec.gov/v1/filings/", publishedAt: null, retrievedAt: instant(now), parserVersion: "fec-receipt-cutoff-v2", license: "public" });
    const sink = async (page: FecPageArtifact) => { live(x); const at = instant(now), stored = await x.store.putCanonical({ activation: x.activation, planSha256: x.planSha256, artifactKind: "enumeration_page", canonicalBytes: page.bytes, expectedSha256: page.artifactSha256, signal: x.signal, deadlineMs: x.deadlineMs, expectedContext: { kind: "enumeration_page", provenance: page.page.provenance, pass: page.page.pass, pageNumber: page.page.pageNumber, terminal: page.page.terminal } }); await x.acquisition.stageArtifact({ sha256: page.artifactSha256, kind: "enumeration_page", canonicalByteSize: page.bytes.byteLength, createdAt: at }); await x.acquisition.stageReceipt(receipt(stored, receiptId(x.planSha256, "enumeration_page", page.artifactSha256, stored.versionId), "enumeration_page", page.artifactSha256, page.bytes.byteLength, x.snapshotId, page.upstreamReceipt.upstreamBodySha256, at)); await x.acquisition.stageEnumerationPage({ sha256: page.artifactSha256, canonicalByteSize: page.bytes.byteLength, pass: page.page.pass, formType: page.page.provenance.formType, receiptDate: page.page.provenance.kind === "daily_partition" ? page.page.provenance.receiptDate : null, requestedFileNumber: page.page.provenance.kind === "predecessor_lookup" ? page.page.provenance.requestedFileNumber : null, pageNumber: page.page.pageNumber, terminal: page.page.terminal ? 1 : 0 }); for (const row of page.lineage) await spool.append(row); };
    const result = await (testing?.enumerate ?? enumerateNationwideFecFilings)({ plan: x.plan, planSha256: x.planSha256, budget, apiKey: x.apiKey, ...(testing?.dependencies ? { dependencies: testing.dependencies } : {}), sinkPage: sink }), at = instant(now), stored = await x.store.putCanonical({ activation: x.activation, planSha256: x.planSha256, artifactKind: "filing_ledger", canonicalBytes: result.ledgerBytes, expectedSha256: result.ledgerSha256, signal: x.signal, deadlineMs: x.deadlineMs, expectedContext: { kind: "filing_ledger", planSha256: x.planSha256, artifactSha256: result.ledgerSha256 } });
    await x.acquisition.stageArtifact({ sha256: result.ledgerSha256, kind: "filing_ledger", canonicalByteSize: result.ledgerBytes.byteLength, createdAt: at }); await x.acquisition.stageReceipt(receipt(stored, receiptId(x.planSha256, "filing_ledger", result.ledgerSha256, stored.versionId), "filing_ledger", result.ledgerSha256, result.ledgerBytes.byteLength, x.snapshotId, null, at)); await x.acquisition.stageLedgerHeader({ sha256: result.ledgerSha256, canonicalByteSize: result.ledgerBytes.byteLength, stable: 1, finalizedAt: at });
    const identities = new Map<number, string>(); for (const entry of result.ledger.entries) { const i = entry.identity; identities.set(i.fileNumber, entry.entryIdentitySha256); await x.acquisition.stageLedgerEntry({ ledgerSha256: result.ledgerSha256, fileNumber: i.fileNumber, entryIdentitySha256: entry.entryIdentitySha256, canonicalFormType: i.canonicalFormType, baseFormType: i.baseFormType, reportType: i.reportType, reportDate: i.reportDate, receiptDate: i.receiptDate, coverageStart: i.coverageStartDate, coverageEnd: i.coverageEndDate, amendmentIndicator: i.amendmentIndicator, filerId: i.filerId, committeeId: i.committeeId, electronicStatus: i.electronicStatus, rawSourceAvailability: i.rawAvailability }); if (i.previousFileNumber !== null) await x.acquisition.stageAmendmentLink({ ledgerSha256: result.ledgerSha256, fileNumber: i.fileNumber, entryIdentitySha256: entry.entryIdentitySha256, predecessorFileNumber: i.previousFileNumber }); }
    for await (const row of spool.read()) { live(x); const entryIdentitySha256 = identities.get(row.fileNumber); if (!entryIdentitySha256) throw new Error("FEC_V2_LINEAGE_INVALID"); await x.acquisition.stagePageLineage({ ledgerSha256: result.ledgerSha256, entryIdentitySha256, ...row }); }
    let index = 0; const worker = async () => { for (;;) { const n = index++, entry = result.ledger.entries[n]; if (!entry) return; const id = entry.identity, outcome = id.electronicStatus === "paper" ? "paper_filing_unreviewed" : id.rawAvailability !== "available" ? "source_unavailable" : undefined; try { if (outcome) { await x.acquisition.stageAcquisitionOutcome({ ledgerSha256: result.ledgerSha256, fileNumber: id.fileNumber, entryIdentitySha256: entry.entryIdentitySha256, outcome }); continue; } const pair = result.fecUrlsByFileNumber[n]; if (!pair || pair[0] !== id.fileNumber || !pair[1]) throw new Error("FEC_V2_ACQUISITION_EVIDENCE_INCONSISTENT"); const got = await (testing?.acquire ?? acquireAndStoreFecV2SanitizedFiling)({ planSha256: x.planSha256, ledgerIdentitySha256: entry.entryIdentitySha256, identity: id, layout: x.layout, budget, fecUrl: pair[1], store: x.store, activation: x.activation, signal: x.signal, deadlineMs: x.deadlineMs } as never); await x.acquisition.stageArtifact({ sha256: got.artifactSha256, kind: "sanitized_filing", canonicalByteSize: got.artifactByteSize, createdAt: instant(now) }); await x.acquisition.stageReceipt(receipt(got.receipt, receiptId(x.planSha256, "sanitized_filing", got.artifactSha256, got.receipt.versionId), "sanitized_filing", got.artifactSha256, got.artifactByteSize, x.snapshotId, got.upstreamProvenance.upstreamBodySha256, got.upstreamProvenance.retrievedAt)); await x.acquisition.stageSanitizedFiling({ ledgerSha256: result.ledgerSha256, fileNumber: id.fileNumber, entryIdentitySha256: entry.entryIdentitySha256, sha256: got.artifactSha256, canonicalByteSize: got.artifactByteSize, reportDate: got.artifact.reportDate }); } catch (error) { if (error instanceof FecSanitizedFilingAcquisitionError && error.code === "FEC_SANITIZED_ACQUISITION_UNAVAILABLE" && error.processingOutcome === "source_unavailable") { await x.acquisition.stageAcquisitionOutcome({ ledgerSha256: result.ledgerSha256, fileNumber: id.fileNumber, entryIdentitySha256: entry.entryIdentitySha256, outcome: "source_unavailable" }); continue; } controller.abort(error); throw error; } } }; const results = await Promise.allSettled(Array.from({ length: Math.min(2, result.ledger.entries.length) }, worker)), failed = results.find((value): value is PromiseRejectedResult => value.status === "rejected"); if (failed) throw failed.reason;
    await x.acquisition.finalizeStagedSnapshot(x.snapshotId); const transcript = await replay(x, await x.verifier.stagedReceiptDescriptors()), c = await x.verifier.stagedCommitment(), run = decodeFecV2RunDescriptor(Buffer.from(c.descriptor)); if (fecV2RunDescriptorSha256(run) !== c.descriptorSha256) throw new Error("FEC_V2_REPLAY_COMMITMENT_INVALID"); await verifyStagedArtifactGraphParity(x.verifier, transcript.artifacts); await x.verifier.issueStagedPromotionAttestation(c.acquisitionGraphSha256, c.descriptorSha256, transcript.sha256); await x.acquisition.promote(c.acquisitionGraphSha256, c.descriptorSha256, transcript.sha256); return x.runId;
  } finally { await spool.cleanup(); }
}

export const coordinateFecV2Acquisition = (input: Core): Promise<string> => coordinate(input);
export const coordinateFecV2AcquisitionForTesting = (input: Core, deps: FecV2CoordinatorTestingDeps): Promise<string> => { if (process.env.NODE_ENV === "production") return Promise.reject(new Error("FEC_V2_CONFIGURATION_INVALID")); return coordinate(input, deps); };
export async function reuseCompletedFecV2Acquisition(input: Omit<Core, "runId" | "snapshotId" | "apiKey" | "layout">): Promise<string | undefined> {
  const c = await input.verifier.completedCommitment(); if (!c) return undefined;
  const replayInput = { ...input, runId: c.originRunId } as Core;
  const transcript = await replay(replayInput, await input.verifier.completedReceiptDescriptors());
  if (transcript.sha256 !== c.transcriptSha256) throw new Error("FEC_V2_REPLAY_COMMITMENT_INVALID");
  await verifyCompletedArtifactGraphParity(input.verifier, transcript.artifacts);
  const attestation = await input.verifier.issueCompletedReuseAttestation(c.acquisitionGraphSha256, c.descriptorSha256, transcript.sha256);
  const consumed = await input.acquisition.consumeCompletedReuse(attestation, c.acquisitionGraphSha256, c.descriptorSha256, transcript.sha256);
  if (consumed.descriptor !== c.descriptor || consumed.descriptorSha256 !== c.descriptorSha256) throw new Error("FEC_V2_REPLAY_COMMITMENT_INVALID");
  return c.originRunId;
}

const graphKey = (row: Record<string, unknown>, fields: readonly string[]): string => fields.map(field => String(row[field] ?? "")).join("\0");
/** Compare decoded evidence with every staged semantic edge; never trust graph hashes alone. */
type FecV2GraphReader = Pick<FecV2ReplayVerifierPersistence, "stagedEnumerationPages" | "stagedLedgerHeaders" | "stagedLedgerEntries" | "stagedPageLineage" | "stagedAmendmentLinks" | "stagedSanitizedFilings">;
export async function verifyStagedArtifactGraphParity(verifier: FecV2GraphReader, artifacts: ReadonlyMap<string, FecV2ArtifactTranscript>): Promise<void> {
  const pages = await verifier.stagedEnumerationPages(), headers = await verifier.stagedLedgerHeaders(), entries = await verifier.stagedLedgerEntries(), lineage = await verifier.stagedPageLineage(), amendments = await verifier.stagedAmendmentLinks(), filings = await verifier.stagedSanitizedFilings();
  const decodedPages = [...artifacts.values()].filter((x): x is Extract<FecV2ArtifactTranscript, { artifactKind: "enumeration_page" }> => x.artifactKind === "enumeration_page");
  const decodedLedger = [...artifacts.values()].filter((x): x is Extract<FecV2ArtifactTranscript, { artifactKind: "filing_ledger" }> => x.artifactKind === "filing_ledger");
  const decodedFilings = [...artifacts.values()].filter((x): x is Extract<FecV2ArtifactTranscript, { artifactKind: "sanitized_filing" }> => x.artifactKind === "sanitized_filing");
  if (headers.length !== 1 || decodedLedger.length !== 1 || pages.length !== decodedPages.length || filings.length !== decodedFilings.length) throw new Error("FEC_V2_GRAPH_PARITY_INVALID");
  const ledger = decodedLedger[0]!, header = headers[0]!;
  if (header.artifact_sha256 !== ledger.artifactSha256 || header.stable !== 1 || ledger.decoded.stable !== true || entries.length !== ledger.decoded.entries.length) throw new Error("FEC_V2_GRAPH_PARITY_INVALID");
  const entryMap = new Map(entries.map(row => [graphKey(row, ["file_number", "entry_identity_sha256"]), row]));
  for (const entry of ledger.decoded.entries) { const i = entry.identity, row = entryMap.get(`${i.fileNumber}\0${entry.entryIdentitySha256}`); if (!row || row.canonical_form_type !== i.canonicalFormType || row.base_form_type !== i.baseFormType || row.report_type !== i.reportType || row.report_date !== i.reportDate || row.receipt_date !== i.receiptDate || row.coverage_start !== i.coverageStartDate || row.coverage_end !== i.coverageEndDate || row.amendment_indicator !== i.amendmentIndicator || row.filer_id !== i.filerId || row.committee_id !== i.committeeId || row.electronic_status !== i.electronicStatus || row.raw_source_availability !== i.rawAvailability) throw new Error("FEC_V2_GRAPH_PARITY_INVALID"); }
  for (const page of decodedPages) { const row = pages.find(x => x.artifact_sha256 === page.artifactSha256); if (!row || row.pass !== page.decoded.pass || row.page_number !== page.decoded.pageNumber || row.terminal !== (page.decoded.terminal ? 1 : 0) || row.form_type !== page.decoded.provenance.formType) throw new Error("FEC_V2_GRAPH_PARITY_INVALID"); for (const record of page.decoded.records) if (!lineage.some(x => x.page_sha256 === page.artifactSha256 && x.pass === page.decoded.pass && x.file_number === record.identity.fileNumber && x.entry_identity_sha256 === record.entryIdentitySha256 && x.occurrence_index === record.occurrenceIndex)) throw new Error("FEC_V2_GRAPH_PARITY_INVALID"); }
  if (lineage.length !== decodedPages.reduce((n, page) => n + page.decoded.records.length, 0)) throw new Error("FEC_V2_GRAPH_PARITY_INVALID");
  for (const entry of ledger.decoded.entries) { const previous = entry.identity.previousFileNumber; if (previous !== null && !amendments.some(x => x.file_number === entry.identity.fileNumber && x.entry_identity_sha256 === entry.entryIdentitySha256 && x.predecessor_file_number === previous)) throw new Error("FEC_V2_GRAPH_PARITY_INVALID"); }
  if (amendments.length !== ledger.decoded.entries.filter(x => x.identity.previousFileNumber !== null).length) throw new Error("FEC_V2_GRAPH_PARITY_INVALID");
  for (const filing of decodedFilings) if (!filings.some(x => x.artifact_sha256 === filing.artifactSha256 && x.file_number === filing.decoded.fileNumber && x.entry_identity_sha256 === filing.decoded.ledgerIdentitySha256 && x.report_date === filing.decoded.reportDate)) throw new Error("FEC_V2_GRAPH_PARITY_INVALID");
}

/** Same semantic proof, sourced only from the selected sealed final closure. */
export async function verifyCompletedArtifactGraphParity(verifier: FecV2ReplayVerifierPersistence, artifacts: ReadonlyMap<string, FecV2ArtifactTranscript>): Promise<void> {
  return verifyStagedArtifactGraphParity({ stagedEnumerationPages: () => verifier.completedEnumerationPages(), stagedLedgerHeaders: () => verifier.completedLedgerHeaders(), stagedLedgerEntries: () => verifier.completedLedgerEntries(), stagedPageLineage: () => verifier.completedPageLineage(), stagedAmendmentLinks: () => verifier.completedAmendmentLinks(), stagedSanitizedFilings: () => verifier.completedSanitizedFilings() }, artifacts);
}
