import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { describe, expect, it } from "vitest";
import type {
  RawObjectPut,
  RawObjectResult,
  RawObjectStore,
} from "../core/raw-object-store";
import type { RawObject } from "../core/types";
import {
  createFecAdapter,
  decodeFecStagedExtras,
  type FecStageRow,
} from "./adapter";
import {
  encodeFecSanitizedEnvelope,
  fecEnvelopeSha256,
  FEC_SANITIZED_ADAPTER_VERSION,
  type FecSanitizedEnvelopeV1,
} from "./envelope";
import {
  fecEnvelopeFixture,
  fecEnvelopeWithoutAuthorizedCommittee,
} from "./fec-test-fixture";

const collect = async <T>(values: AsyncIterable<T>): Promise<T[]> => {
  const result: T[] = [];
  for await (const value of values) result.push(value);
  return result;
};

class MemoryStore implements RawObjectStore {
  constructor(private readonly kind: "local" | "s3" = "local") {}
  bytes = Buffer.alloc(0);
  receipt: RawObjectResult | null = null;
  async put(input: RawObjectPut): Promise<RawObjectResult> {
    const chunks: Buffer[] = [];
    for await (const chunk of input.body) chunks.push(Buffer.from(chunk));
    this.bytes = Buffer.concat(chunks);
    const sha256 = createHash("sha256").update(this.bytes).digest("hex");
    if (input.expectedSha256 !== sha256) throw new Error("checksum mismatch");
    this.receipt = {
      storeKind: this.kind,
      storeLocator: this.kind === "s3" ? "bucket" : "/tmp/fec-test",
      objectKey: this.kind === "s3" ? `${input.objectKey}.${sha256}` : input.objectKey,
      sha256,
      byteSize: this.bytes.byteLength,
      ...(this.kind === "s3" ? { versionId: "version-1" } : {}),
    };
    return this.receipt;
  }
  async read(): Promise<Uint8Array> {
    return this.bytes;
  }
}

const adapterFor = (
  envelope: FecSanitizedEnvelopeV1 = fecEnvelopeFixture(),
  overrides: Partial<Parameters<typeof createFecAdapter>[0]> = {},
  rawStore = new MemoryStore(),
) => {
  const envelopeBytes = encodeFecSanitizedEnvelope(envelope);
  return {
    envelopeBytes,
    rawStore,
    adapter: createFecAdapter({
      envelopeBytes,
      envelopeChecksumSha256: fecEnvelopeSha256(envelopeBytes),
      envelopeByteSize: envelopeBytes.byteLength,
      sourceLockSha256: envelope.sourceLockSha256,
      rawStore,
      snapshotId: "snap_fec_test" as never,
      upstreamRelease: "openfec-v1",
      parserVersion: FEC_SANITIZED_ADAPTER_VERSION,
      ...overrides,
    }),
  };
};

const extract = async (adapter: ReturnType<typeof adapterFor>["adapter"]) =>
  (
    await collect(
      adapter.extract({
        releaseId: "rel_test" as never,
        sourceId: "src_fec" as never,
        cutoff: new Date("2024-12-31T00:00:00.000Z"),
      }),
    )
  )[0]!;

const stagedDatabaseRow = (raw: RawObject<FecSanitizedEnvelopeV1>, row: FecStageRow) => ({
  extracted_count: 1,
  staged_count: 1,
  quarantined_count: 0,
  run_snapshot_id: raw.snapshot.id,
  raw_object_sha256: raw.receipt.sha256,
  adapter_version: FEC_SANITIZED_ADAPTER_VERSION,
  upstream_release: "openfec-v1",
  source_natural_key: row.sourceNaturalKey,
  snapshot_id: raw.snapshot.id,
  committee_id: row.committeeId,
  filing_id: row.filingId,
  report_type: row.reportType,
  reporting_period_start: row.reportingPeriodStart,
  reporting_period_end: row.reportingPeriodEnd,
  filed_at: row.filedAt,
  amendment_number: row.amendmentNumber,
  cash_on_hand: row.cashOnHand,
  total_receipts: row.totalReceipts,
  total_disbursements: row.totalDisbursements,
  redacted_extras: row.redactedExtras,
});

describe("FEC sanitized adapter", () => {
  it("stores only canonical sanitized bytes and emits a restricted snapshot", async () => {
    const { adapter, envelopeBytes, rawStore } = adapterFor();
    const raw = await extract(adapter);
    expect(Object.isFrozen(raw.receipt)).toBe(true);
    expect(Object.isFrozen(raw.snapshot)).toBe(true);
    expect(rawStore.bytes).toEqual(Buffer.from(envelopeBytes));
    expect(rawStore.bytes.toString("utf8")).not.toMatch(
      /canary@example|api[_-]?key|treasurer/i,
    );
    expect(raw.snapshot).toMatchObject({
      sourceUrl: "urn:dsa-seats:fec:sanitized-envelope:v1:H00000001:2024",
      usageStatus: "restricted",
      upstreamRelease: "openfec-v1",
    });
    expect(raw.snapshot.license).toContain("licensing review required");
    const parsed = await collect(adapter.parse(raw));
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      kind: "row",
      row: { committeeId: "C00000001", cashOnHand: "1.00" },
    });
    await expect(
      collect(
        adapter.parse({
          ...raw,
          snapshot: { ...raw.snapshot, usageStatus: "approved" },
        }),
      ),
    ).rejects.toThrow("FEC_RAW_BINDING_MISMATCH");
    expect(() => {
      (raw.receipt as { storeKind: string }).storeKind = "unknown";
    }).toThrow(TypeError);
    await expect(
      collect(
        adapter.parse({
          ...raw,
          receipt: { ...raw.receipt, storeKind: "unknown" as never },
        }),
      ),
    ).rejects.toThrow("FEC_RAW_BINDING_MISMATCH");
    await expect(
      collect(
        adapter.parse({
          ...raw,
          receipt: {
            ...raw.receipt,
            storeKind: "s3",
            storeLocator: "bucket",
            objectKey: `${raw.receipt.objectKey}.${raw.receipt.sha256}`,
            versionId: "version-1",
          },
        }),
      ),
    ).rejects.toThrow("FEC_RAW_BINDING_MISMATCH");
    await expect(
      collect(
        adapter.parse({
          ...raw,
          receipt: { ...raw.receipt, objectKey: "fec/wrong.json" },
        }),
      ),
    ).rejects.toThrow("FEC_RAW_BINDING_MISMATCH");
  });

  it("rejects cutoff, parser, upstream, and envelope receipt drift", async () => {
    const { adapter } = adapterFor();
    await expect(
      collect(
        adapter.extract({
          releaseId: "rel_test" as never,
          sourceId: "src_fec" as never,
          cutoff: new Date("2024-12-30T00:00:00.000Z"),
        }),
      ),
    ).rejects.toThrow("FEC_CUTOFF_MISMATCH");
    expect(() => adapterFor(fecEnvelopeFixture(), { parserVersion: "old" })).toThrow(
      "FEC_ENVELOPE_RECEIPT_MISMATCH",
    );
    expect(() =>
      adapterFor(fecEnvelopeFixture(), { upstreamRelease: "other" }),
    ).toThrow("FEC_ENVELOPE_RECEIPT_MISMATCH");
    expect(() =>
      adapterFor(fecEnvelopeFixture(), { envelopeChecksumSha256: "f".repeat(64) }),
    ).toThrow("FEC_ENVELOPE_RECEIPT_MISMATCH");
  });

  it("accepts the exact S3 receipt emitted by extraction", async () => {
    const store = new MemoryStore("s3");
    const { adapter } = adapterFor(fecEnvelopeFixture(), {}, store);
    const raw = await extract(adapter);
    expect(raw.receipt).toMatchObject({
      storeKind: "s3",
      storeLocator: "bucket",
      versionId: "version-1",
    });
    expect(raw.receipt.objectKey).toBe(
      `fec/2024/H00000001/${raw.receipt.sha256}.json.${raw.receipt.sha256}`,
    );
    await expect(collect(adapter.parse(raw))).resolves.toHaveLength(1);
  });

  it("stages bounded extras and validates every envelope-derived field", async () => {
    const { adapter } = adapterFor();
    const raw = await extract(adapter);
    const parsed = await collect(adapter.parse(raw));
    const row = parsed[0]!.kind === "row" ? parsed[0]!.row : undefined;
    expect(row).toBeDefined();
    const calls: Array<{ text: string; values?: readonly unknown[] }> = [];
    await adapter.stage(
      {
        query: async (text: string, values?: readonly unknown[]) => {
          calls.push({ text, values });
          return { rows: [], rowCount: 0 } as never;
        },
      } as unknown as PoolClient,
      "run_test",
      [row!],
    );
    const serializedExtras = String(
      (calls[0]!.values?.[12] as readonly string[] | undefined)?.[0],
    );
    expect(decodeFecStagedExtras(JSON.parse(serializedExtras))).toEqual(
      row!.redactedExtras,
    );
    expect(serializedExtras).not.toMatch(/pageReceipts|candidateTotals|outsideSpending/);

    const validate = (databaseRow: Record<string, unknown>) =>
      adapter.validateStaged(
        {
          query: async () => ({ rows: [databaseRow], rowCount: 1 }) as never,
        } as unknown as PoolClient,
        "run_test",
      );
    await expect(validate(stagedDatabaseRow(raw, row!))).resolves.toEqual([]);
    await expect(
      validate({ ...stagedDatabaseRow(raw, row!), total_receipts: "999.00" }),
    ).resolves.toMatchObject([{ code: "FEC_STAGE_INVALID" }]);
    await expect(
      validate({ ...stagedDatabaseRow(raw, row!), total_receipts: "2.009" }),
    ).resolves.toMatchObject([{ code: "FEC_STAGE_INVALID" }]);
    await expect(
      validate({
        ...stagedDatabaseRow(raw, row!),
        redacted_extras: {
          ...row!.redactedExtras,
          amendmentChain: [999],
        },
      }),
    ).resolves.toMatchObject([{ code: "FEC_STAGE_INVALID" }]);
    await expect(adapter.loadFromStage({} as never, "run", "rel" as never)).rejects.toThrow(
      "FEC_FINALIZE_REQUIRED",
    );
  });

  it("validates an evidence-backed zero-report staging run", async () => {
    const { adapter } = adapterFor(fecEnvelopeWithoutAuthorizedCommittee());
    const raw = await extract(adapter);
    expect(raw.expectedRecordCount).toBe(0);
    const issues = await adapter.validateStaged(
      {
        query: async () => ({
          rows: [
            {
              extracted_count: 0,
              staged_count: 0,
              quarantined_count: 0,
              run_snapshot_id: raw.snapshot.id,
              raw_object_sha256: raw.receipt.sha256,
              adapter_version: FEC_SANITIZED_ADAPTER_VERSION,
              upstream_release: "openfec-v1",
              source_natural_key: null,
            },
          ],
          rowCount: 1,
        }) as never,
      } as unknown as PoolClient,
      "run_zero",
    );
    expect(issues).toEqual([]);
  });
});
