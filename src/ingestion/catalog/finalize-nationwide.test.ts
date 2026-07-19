import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/catalog-release", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/db/catalog-release")>()), recheckNationwideValidationGate: vi.fn() }));
vi.mock("@/ingestion/identity/adapter", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/ingestion/identity/adapter")>()), decodeIdentityEnvelope: vi.fn(() => ({ sourceLockSha256: "a".repeat(64) })) }));
vi.mock("@/ingestion/tiger/adapter", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/ingestion/tiger/adapter")>()), decodeTigerEnvelope: vi.fn(() => ({ sourceLockSha256: "a".repeat(64) })) }));

import { recheckNationwideValidationGate } from "@/db/catalog-release";
import { finalizeNationwideCandidate, locateNationwideCandidatePoint, requireDerivedAuthority } from "./finalize-nationwide";

const loadedRun = (id: string, source: "identity" | "tiger", status: "validated" | "loaded" = "loaded") => { const raw = Buffer.from(source); const checksum = createHash("sha256").update(raw).digest("hex"); return { id, release_id: "rel_a", source_id: `src_${source}`, snapshot_id: `snap_${source}`, adapter_version: "v1", upstream_release: "upstream", raw_store_kind: "local" as const, raw_store_locator: ".raw", raw_object_key: `${source}.json`, raw_object_sha256: checksum, raw_object_byte_size: raw.byteLength, raw_object_version_id: null, raw_object_etag: null, lease_token: "lease", status, extracted_count: 1, staged_count: 1, quarantined_count: 0, source_name: source, source_authority: "derived", source_homepage_url: "https://example.test", snapshot_checksum: checksum, snapshot_parser_version: "v1", source_url: "https://example.test/raw", published_at: null, retrieved_at: new Date(), license: "public-domain", usage_status: "approved", release_label: "candidate", source_cutoff: new Date("2025-01-01"), created_at: new Date() }; };

function retryPool(identityStatus: "validated" | "loaded" = "loaded", tigerStatus: "validated" | "loaded" = "loaded") {
  const client = { query: vi.fn(async (sql: string) => sql.includes("FROM ingest_runs") ? { rowCount: 2, rows: [loadedRun("run_i", "identity", identityStatus), loadedRun("run_t", "tiger", tigerStatus)] } : sql.includes("FROM data_releases") ? { rowCount: 1, rows: [] } : { rowCount: 0, rows: [] }), release: vi.fn() };
  return { connect: vi.fn().mockResolvedValue(client), client };
}

describe("nationwide finalizer point guard", () => {
  it("accepts only derived envelope sources", () => {
    expect(requireDerivedAuthority("derived")).toBe("derived");
    expect(() => requireDerivedAuthority("official")).toThrow("NATIONWIDE_FINALIZE_SOURCE_INVALID");
    expect(() => requireDerivedAuthority("editorial")).toThrow("NATIONWIDE_FINALIZE_SOURCE_INVALID");
  });

  it("rejects non-finite and out-of-range WGS84 coordinates before querying", async () => {
    let called = false;
    const client = { query: async () => { called = true; return { rows: [] }; } } as unknown as PoolClient;
    await expect(locateNationwideCandidatePoint(client, "candidate", Number.NaN, 0)).rejects.toThrow("NATIONWIDE_POINT_INVALID");
    await expect(locateNationwideCandidatePoint(client, "candidate", 0, 91)).rejects.toThrow("NATIONWIDE_POINT_INVALID");
    expect(called).toBe(false);
  });

  it("reconciles an ambiguous successful commit using only the gate recheck", async () => {
    const pool = retryPool(); const rawStore = { read: vi.fn(async (receipt: { objectKey: string }) => Buffer.from(receipt.objectKey.startsWith("identity") ? "identity" : "tiger")) };
    await expect(finalizeNationwideCandidate({ pool: pool as never, rawStore: rawStore as never, releaseId: "rel_a", identityRunId: "run_i", tigerRunId: "run_t", sourceLockSha256: "a".repeat(64) })).resolves.toBeUndefined();
    expect(recheckNationwideValidationGate).toHaveBeenCalledWith(pool.client, "rel_a");
    expect(rawStore.read).toHaveBeenCalledTimes(2);
    expect(pool.client.query).toHaveBeenLastCalledWith("COMMIT");
  });

  it("rejects a mixed loaded and validated retry before reading raw artifacts", async () => {
    const pool = retryPool("loaded", "validated"); const rawStore = { read: vi.fn() };
    await expect(finalizeNationwideCandidate({ pool: pool as never, rawStore: rawStore as never, releaseId: "rel_a", identityRunId: "run_i", tigerRunId: "run_t", sourceLockSha256: "a".repeat(64) })).rejects.toThrow("NATIONWIDE_FINALIZE_RUN_INVALID");
    expect(rawStore.read).not.toHaveBeenCalled();
  });
});
