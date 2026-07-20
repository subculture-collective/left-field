import type { SnapshotId } from "@/domain/contracts";
import type { RawObjectResult, RawObjectStore } from "../core/raw-object-store";
import type { SourceAdapter, ValidationIssue } from "../core/types";
import { resolveFecAmendments } from "./amendments";
import {
  decodeFecSanitizedEnvelope,
  encodeFecSanitizedEnvelope,
  fecEnvelopeSha256,
  FEC_SANITIZED_ADAPTER_VERSION,
  type FecSanitizedEnvelopeV1,
} from "./envelope";

export interface FecAdapterOptions {
  readonly envelopeBytes: Uint8Array;
  readonly envelopeChecksumSha256: string;
  readonly envelopeByteSize: number;
  readonly sourceLockSha256: string;
  readonly rawStore: RawObjectStore;
  readonly snapshotId: SnapshotId;
  readonly upstreamRelease: string;
  readonly parserVersion: string;
}
export interface FecStagedExtrasV1 {
  readonly schemaVersion: 1;
  readonly envelopeChecksumSha256: string;
  readonly candidateId: string;
  readonly electionCycle: number;
  readonly electionKey: string;
  readonly amendmentIndicator: "N" | "A" | "T" | "C" | "M" | "S" | null;
  readonly amendmentChain: readonly number[];
  readonly mostRecent: boolean | null;
  readonly mostRecentFileNumber: number | null;
  readonly missingReasons: {
    readonly cashOnHand: "not_reported" | null;
    readonly totalReceipts: "not_reported" | null;
    readonly totalDisbursements: "not_reported" | null;
  };
}
export interface FecStageRow {
  readonly sourceNaturalKey: string;
  readonly committeeId: string;
  readonly filingId: string;
  readonly reportType: string;
  readonly reportingPeriodStart: string;
  readonly reportingPeriodEnd: string;
  readonly filedAt: string;
  readonly amendmentNumber: number;
  readonly cashOnHand: string | null;
  readonly totalReceipts: string | null;
  readonly totalDisbursements: string | null;
  readonly redactedExtras: FecStagedExtrasV1;
}

const validSha = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const extrasKeys = [
  "schemaVersion",
  "envelopeChecksumSha256",
  "candidateId",
  "electionCycle",
  "electionKey",
  "amendmentIndicator",
  "amendmentChain",
  "mostRecent",
  "mostRecentFileNumber",
  "missingReasons",
] as const;

export function decodeFecStagedExtras(value: unknown): FecStagedExtrasV1 {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("FEC_EXTRAS_INVALID");
  const extras = value as Record<string, unknown>;
  if (
    Object.keys(extras).length !== extrasKeys.length ||
    extrasKeys.some((key) => !(key in extras)) ||
    extras.schemaVersion !== 1 ||
    !validSha(extras.envelopeChecksumSha256) ||
    typeof extras.candidateId !== "string" ||
    !Number.isSafeInteger(extras.electionCycle) ||
    typeof extras.electionKey !== "string" ||
    !(extras.amendmentIndicator === null || ["N", "A", "T", "C", "M", "S"].includes(String(extras.amendmentIndicator))) ||
    !Array.isArray(extras.amendmentChain) ||
    extras.amendmentChain.length === 0 ||
    !extras.amendmentChain.every(
      (item) => Number.isSafeInteger(item) && Number(item) > 0,
    ) ||
    !(
      extras.mostRecent === null || typeof extras.mostRecent === "boolean"
    ) ||
    !(
      extras.mostRecentFileNumber === null ||
      (Number.isSafeInteger(extras.mostRecentFileNumber) &&
        Number(extras.mostRecentFileNumber) > 0)
    ) ||
    !extras.missingReasons ||
    typeof extras.missingReasons !== "object" ||
    Array.isArray(extras.missingReasons)
  )
    throw new Error("FEC_EXTRAS_INVALID");
  const reasons = extras.missingReasons as Record<string, unknown>;
  const reasonKeys = ["cashOnHand", "totalReceipts", "totalDisbursements"];
  if (
    Object.keys(reasons).length !== reasonKeys.length ||
    reasonKeys.some(
      (key) => reasons[key] !== null && reasons[key] !== "not_reported",
    )
  )
    throw new Error("FEC_EXTRAS_INVALID");
  return extras as unknown as FecStagedExtrasV1;
}

const chunks = async function* (bytes: Uint8Array): AsyncIterable<Uint8Array> {
  yield bytes;
};
const stageRows = (
  envelope: FecSanitizedEnvelopeV1,
  checksum: string,
): FecStageRow[] =>
  resolveFecAmendments(envelope.reports).map((report) => ({
    sourceNaturalKey: `fec:${report.committeeId}:${report.fileNumber}`,
    committeeId: report.committeeId,
    filingId: String(report.fileNumber),
    reportType: report.reportType,
    reportingPeriodStart: report.coverageStartDate,
    reportingPeriodEnd: report.coverageEndDate,
    filedAt: `${report.receiptDate}T00:00:00.000Z`,
    amendmentNumber: report.amendmentNumber,
    cashOnHand: report.cashOnHandEndPeriod,
    totalReceipts: report.totalReceiptsYtd,
    totalDisbursements: report.totalDisbursementsYtd,
    redactedExtras: {
      schemaVersion: 1,
      envelopeChecksumSha256: checksum,
      candidateId: envelope.candidateId,
      electionCycle: envelope.electionCycle,
      electionKey: envelope.electionKey,
      amendmentIndicator: report.amendmentIndicator,
      amendmentChain: report.amendmentChain,
      mostRecent: report.mostRecent,
      mostRecentFileNumber: report.mostRecentFileNumber,
      missingReasons: {
        cashOnHand:
          report.cashOnHandEndPeriod === null ? "not_reported" : null,
        totalReceipts:
          report.totalReceiptsYtd === null ? "not_reported" : null,
        totalDisbursements:
          report.totalDisbursementsYtd === null ? "not_reported" : null,
      },
    },
  }));

const normalizeDate = (value: unknown): string | null => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);
  return null;
};
const normalizeTimestamp = (value: unknown): string | null => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};
/** Converts only an exact non-negative cent amount; never rounds database numerics. */
export const normalizeFecCents = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const match = /^(\d+)(?:\.(\d+))?$/.exec(String(value));
  if (!match) return "invalid";
  if ((match[2]?.length ?? 0) > 2) return "invalid";
  const cents = `${match[1]!.replace(/^0+(?=\d)/, "")}${(
    (match[2] ?? "") + "00"
  ).slice(0, 2)}`.replace(/^0+(?=\d)/, "");
  return cents.length > 16 || (cents.length === 16 && cents > "9007199254740991")
    ? "invalid"
    : cents;
};
const extrasEqual = (actual: FecStagedExtrasV1, expected: FecStagedExtrasV1) =>
  actual.schemaVersion === expected.schemaVersion &&
  actual.envelopeChecksumSha256 === expected.envelopeChecksumSha256 &&
  actual.candidateId === expected.candidateId &&
  actual.electionCycle === expected.electionCycle &&
  actual.electionKey === expected.electionKey &&
  actual.amendmentIndicator === expected.amendmentIndicator &&
  actual.amendmentChain.length === expected.amendmentChain.length &&
  actual.amendmentChain.every(
    (item, index) => item === expected.amendmentChain[index],
  ) &&
  actual.mostRecent === expected.mostRecent &&
  actual.mostRecentFileNumber === expected.mostRecentFileNumber &&
  actual.missingReasons.cashOnHand === expected.missingReasons.cashOnHand &&
  actual.missingReasons.totalReceipts ===
    expected.missingReasons.totalReceipts &&
  actual.missingReasons.totalDisbursements ===
    expected.missingReasons.totalDisbursements;

/** Exact typed comparison shared by staging validation and finalization replay. */
export function fecStagedRowEquals(
  actual: Readonly<{
    sourceNaturalKey: unknown; snapshotId: unknown; committeeId: unknown;
    filingId: unknown; reportType: unknown; reportingPeriodStart: unknown;
    reportingPeriodEnd: unknown; filedAt: unknown; amendmentNumber: unknown;
    cashOnHand: unknown; totalReceipts: unknown; totalDisbursements: unknown;
    redactedExtras: unknown;
  }>,
  expected: FecStageRow,
  snapshotId: unknown,
): boolean {
  let extras: FecStagedExtrasV1;
  try {
    extras = decodeFecStagedExtras(
      typeof actual.redactedExtras === "string"
        ? JSON.parse(actual.redactedExtras)
        : actual.redactedExtras,
    );
  } catch {
    return false;
  }
  return (
    String(actual.snapshotId) === String(snapshotId) &&
    actual.sourceNaturalKey === expected.sourceNaturalKey &&
    actual.committeeId === expected.committeeId &&
    actual.filingId === expected.filingId &&
    actual.reportType === expected.reportType &&
    normalizeDate(actual.reportingPeriodStart) === expected.reportingPeriodStart &&
    normalizeDate(actual.reportingPeriodEnd) === expected.reportingPeriodEnd &&
    normalizeTimestamp(actual.filedAt) === expected.filedAt &&
    Number(actual.amendmentNumber) === expected.amendmentNumber &&
    normalizeFecCents(actual.cashOnHand) === normalizeFecCents(expected.cashOnHand) &&
    normalizeFecCents(actual.totalReceipts) === normalizeFecCents(expected.totalReceipts) &&
    normalizeFecCents(actual.totalDisbursements) === normalizeFecCents(expected.totalDisbursements) &&
    extrasEqual(extras, expected.redactedExtras)
  );
}

export function createFecAdapter(
  options: FecAdapterOptions,
): SourceAdapter<FecSanitizedEnvelopeV1, FecStageRow> {
  if (
    !validSha(options.envelopeChecksumSha256) ||
    !validSha(options.sourceLockSha256) ||
    !Number.isSafeInteger(options.envelopeByteSize) ||
    options.envelopeByteSize !== options.envelopeBytes.byteLength ||
    options.parserVersion !== FEC_SANITIZED_ADAPTER_VERSION ||
    options.upstreamRelease !== "openfec-v1" ||
    fecEnvelopeSha256(options.envelopeBytes) !== options.envelopeChecksumSha256
  )
    throw new Error("FEC_ENVELOPE_RECEIPT_MISMATCH");
  const envelope = decodeFecSanitizedEnvelope(options.envelopeBytes);
  if (envelope.sourceLockSha256 !== options.sourceLockSha256)
    throw new Error("FEC_ENVELOPE_BINDING_MISMATCH");
  const expectedRows = stageRows(envelope, options.envelopeChecksumSha256);
  let extractedReceipt: RawObjectResult | undefined;
  let extractedSnapshot:
    | Readonly<{
        id: SnapshotId;
        sourceUrl: string;
        checksumSha256: string;
        upstreamRelease: string;
        publishedAt: Date | null;
        license: string;
        usageStatus: "approved" | "restricted" | "review_required";
      }>
    | undefined;
  return {
    sourceName: "fec",
    adapterVersion: FEC_SANITIZED_ADAPTER_VERSION,
    async *extract(context) {
      if (context.signal?.aborted) throw new Error("INGEST_ABORTED");
      if (context.cutoff.toISOString().slice(0, 10) !== envelope.releaseCutoff)
        throw new Error("FEC_CUTOFF_MISMATCH");
      const receipt = await options.rawStore.put({
        objectKey: `fec/${envelope.electionCycle}/${envelope.candidateId}/${options.envelopeChecksumSha256}.json`,
        body: chunks(options.envelopeBytes),
        expectedSha256: options.envelopeChecksumSha256,
        signal: context.signal,
      });
      if (
        !["local", "s3"].includes(receipt.storeKind) ||
        !receipt.storeLocator ||
        receipt.sha256 !== options.envelopeChecksumSha256 ||
        receipt.byteSize !== options.envelopeByteSize ||
        (receipt.storeKind === "local" &&
          (receipt.objectKey !==
            `fec/${envelope.electionCycle}/${envelope.candidateId}/${options.envelopeChecksumSha256}.json` ||
            receipt.versionId !== undefined)) ||
        (receipt.storeKind === "s3" &&
          (receipt.objectKey !==
            `fec/${envelope.electionCycle}/${envelope.candidateId}/${options.envelopeChecksumSha256}.json.${options.envelopeChecksumSha256}` ||
            !receipt.versionId))
      )
        throw new Error("FEC_ENVELOPE_RECEIPT_MISMATCH");
      const snapshot = {
        id: options.snapshotId,
        sourceUrl: `urn:dsa-seats:fec:sanitized-envelope:v1:${envelope.candidateId}:${envelope.electionCycle}`,
        checksumSha256: receipt.sha256,
        upstreamRelease: "openfec-v1",
        publishedAt: null,
        license:
          "FEC disclosed-information restrictions; licensing review required before publication.",
        usageStatus: "restricted" as const,
      };
      const frozenReceipt = Object.freeze({ ...receipt });
      const frozenSnapshot = Object.freeze({ ...snapshot });
      extractedReceipt = frozenReceipt;
      extractedSnapshot = frozenSnapshot;
      yield {
        value: envelope,
        receipt: frozenReceipt,
        snapshot: frozenSnapshot,
        expectedRecordCount: expectedRows.length,
      };
    },
    async *parse(raw) {
      const rawBytes = encodeFecSanitizedEnvelope(raw.value);
      if (!extractedReceipt || !extractedSnapshot)
        throw new Error("FEC_RAW_BINDING_MISMATCH");
      const baseObjectKey = `fec/${envelope.electionCycle}/${envelope.candidateId}/${options.envelopeChecksumSha256}.json`;
      const expectedObjectKey =
        raw.receipt.storeKind === "s3"
          ? `${baseObjectKey}.${options.envelopeChecksumSha256}`
          : baseObjectKey;
      const expectedSourceUrl = `urn:dsa-seats:fec:sanitized-envelope:v1:${envelope.candidateId}:${envelope.electionCycle}`;
      if (
        !["local", "s3"].includes(raw.receipt.storeKind) ||
        raw.receipt.sha256 !== options.envelopeChecksumSha256 ||
        JSON.stringify(raw.receipt) !== JSON.stringify(extractedReceipt) ||
        raw.receipt.byteSize !== options.envelopeByteSize ||
        raw.receipt.objectKey !== expectedObjectKey ||
        !raw.receipt.storeLocator ||
        (raw.receipt.storeKind === "local" && raw.receipt.versionId !== undefined) ||
        (raw.receipt.storeKind === "s3" && !raw.receipt.versionId) ||
        raw.snapshot.id !== options.snapshotId ||
        raw.snapshot.id !== extractedSnapshot.id ||
        raw.snapshot.sourceUrl !== extractedSnapshot.sourceUrl ||
        raw.snapshot.checksumSha256 !== extractedSnapshot.checksumSha256 ||
        raw.snapshot.upstreamRelease !== extractedSnapshot.upstreamRelease ||
        raw.snapshot.publishedAt !== extractedSnapshot.publishedAt ||
        raw.snapshot.license !== extractedSnapshot.license ||
        raw.snapshot.usageStatus !== extractedSnapshot.usageStatus ||
        raw.snapshot.sourceUrl !== expectedSourceUrl ||
        raw.snapshot.checksumSha256 !== options.envelopeChecksumSha256 ||
        raw.snapshot.upstreamRelease !== "openfec-v1" ||
        raw.snapshot.publishedAt !== null ||
        raw.snapshot.usageStatus !== "restricted" ||
        raw.snapshot.license !==
          "FEC disclosed-information restrictions; licensing review required before publication." ||
        raw.value.sourceLockSha256 !== options.sourceLockSha256 ||
        !Buffer.from(rawBytes).equals(Buffer.from(options.envelopeBytes))
      )
        throw new Error("FEC_RAW_BINDING_MISMATCH");
      for (const row of stageRows(raw.value, options.envelopeChecksumSha256))
        yield { kind: "row" as const, row };
    },
    naturalKey: (row) => row.sourceNaturalKey,
    async stage(client, runId, rows) {
      if (!rows.length) return;
      await client.query(
        "INSERT INTO stg_fec(run_id,release_id,source_natural_key,snapshot_id,committee_id,filing_id,report_type,reporting_period_start,reporting_period_end,filed_at,amendment_number,cash_on_hand,total_receipts,total_disbursements,redacted_extras) SELECT $1,ir.release_id,x.key,ir.snapshot_id,x.committee,x.filing,x.type,x.starts,x.ends,x.filed,x.amendment,x.cash,x.receipts,x.disbursements,x.extras::jsonb FROM ingest_runs ir CROSS JOIN unnest($2::text[],$3::text[],$4::text[],$5::text[],$6::text[],$7::text[],$8::timestamptz[],$9::int[],$10::numeric[],$11::numeric[],$12::numeric[],$13::jsonb[]) AS x(key,committee,filing,type,starts,ends,filed,amendment,cash,receipts,disbursements,extras) WHERE ir.id=$1",
        [
          runId,
          rows.map((row) => row.sourceNaturalKey),
          rows.map((row) => row.committeeId),
          rows.map((row) => row.filingId),
          rows.map((row) => row.reportType),
          rows.map((row) => row.reportingPeriodStart),
          rows.map((row) => row.reportingPeriodEnd),
          rows.map((row) => row.filedAt),
          rows.map((row) => row.amendmentNumber),
          rows.map((row) => row.cashOnHand),
          rows.map((row) => row.totalReceipts),
          rows.map((row) => row.totalDisbursements),
          rows.map((row) => JSON.stringify(row.redactedExtras)),
        ],
      );
    },
    async validateStaged(client, runId): Promise<readonly ValidationIssue[]> {
      const result = await client.query<Record<string, unknown>>(
        "SELECT ir.extracted_count,ir.staged_count,ir.quarantined_count,ir.snapshot_id AS run_snapshot_id,ir.raw_object_sha256,ir.adapter_version,ir.upstream_release,s.source_natural_key,s.snapshot_id,s.committee_id,s.filing_id,s.report_type,s.reporting_period_start,s.reporting_period_end,s.filed_at,s.amendment_number,s.cash_on_hand,s.total_receipts,s.total_disbursements,s.redacted_extras FROM ingest_runs ir LEFT JOIN stg_fec s ON s.run_id=ir.id WHERE ir.id=$1 ORDER BY s.source_natural_key",
        [runId],
      );
      const expected = new Map(
        expectedRows.map((row) => [row.sourceNaturalKey, row]),
      );
      const actualKeys = new Set<string>();
      let invalid = result.rows.length === 0;
      for (const row of result.rows) {
        if (
          Number(row.extracted_count) !== expectedRows.length ||
          Number(row.staged_count) !== expectedRows.length ||
          Number(row.quarantined_count) !== 0 ||
          String(row.run_snapshot_id) !== String(options.snapshotId) ||
          row.raw_object_sha256 !== options.envelopeChecksumSha256 ||
          row.adapter_version !== FEC_SANITIZED_ADAPTER_VERSION ||
          row.upstream_release !== "openfec-v1"
        ) {
          invalid = true;
          continue;
        }
        if (row.source_natural_key === null) {
          if (expectedRows.length !== 0) invalid = true;
          continue;
        }
        const key = String(row.source_natural_key);
        const expectedRow = expected.get(key);
        if (!expectedRow || actualKeys.has(key)) {
          invalid = true;
          continue;
        }
        actualKeys.add(key);
        if (
          !fecStagedRowEquals(
            {
              sourceNaturalKey: row.source_natural_key,
              snapshotId: row.snapshot_id,
              committeeId: row.committee_id,
              filingId: row.filing_id,
              reportType: row.report_type,
              reportingPeriodStart: row.reporting_period_start,
              reportingPeriodEnd: row.reporting_period_end,
              filedAt: row.filed_at,
              amendmentNumber: row.amendment_number,
              cashOnHand: row.cash_on_hand,
              totalReceipts: row.total_receipts,
              totalDisbursements: row.total_disbursements,
              redactedExtras: row.redacted_extras,
            },
            expectedRow,
            row.run_snapshot_id,
          )
        )
          invalid = true;
      }
      if (actualKeys.size !== expectedRows.length) invalid = true;
      return invalid
        ? [
            {
              code: "FEC_STAGE_INVALID",
              message:
                "FEC staged records do not exactly match their sanitized envelope.",
            },
          ]
        : [];
    },
    async loadFromStage() {
      throw new Error("FEC_FINALIZE_REQUIRED");
    },
  };
}
