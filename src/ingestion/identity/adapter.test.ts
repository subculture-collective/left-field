import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PoolClient } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalRawObjectStore } from "../core/raw-object-store";
import { createIdentityAdapter, decodeIdentityEnvelope, encodeIdentityEnvelope, IDENTITY_ARTIFACT_LIMITS, type IdentityEnvelopeV1, type IdentityStageRow } from "./adapter";
import type { HouseSeat } from "./house";
import { parseSenateRoster, parseSenateServiceStartsArtifact, type SenateSeat } from "./senate";

const digest = (v: Uint8Array) => createHash("sha256").update(v).digest("hex");
const counts: Record<string, number> = { AL: 7, AK: 1, AZ: 9, AR: 4, CA: 52, CO: 8, CT: 5, DE: 1, FL: 28, GA: 14, HI: 2, ID: 2, IL: 17, IN: 9, IA: 4, KS: 4, KY: 6, LA: 6, ME: 2, MD: 8, MA: 9, MI: 13, MN: 8, MS: 4, MO: 8, MT: 2, NE: 3, NV: 4, NH: 2, NJ: 12, NM: 3, NY: 26, NC: 14, ND: 1, OH: 15, OK: 5, OR: 6, PA: 17, RI: 2, SC: 7, SD: 1, TN: 9, TX: 38, UT: 4, VT: 1, VA: 11, WA: 10, WV: 2, WI: 8, WY: 1 };
const houseUniverse: HouseSeat[] = [...Object.entries(counts).flatMap(([stateCode, n]) => Array.from({ length: n }, (_, i) => ({ stateCode, districtCode: (n === 1 ? "AL" : String(i + 1).padStart(2, "0")) as HouseSeat["districtCode"], kind: "representative" as const }))), ...(["DC", "AS", "GU", "MP", "VI"] as const).map(stateCode => ({ stateCode, districtCode: "AL" as const, kind: "delegate" as const })), { stateCode: "PR", districtCode: "AL", kind: "resident_commissioner" }];
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function collect<T>(items: AsyncIterable<T>): Promise<T[]> { const result: T[] = []; for await (const item of items) result.push(item); return result; }

describe("identity source adapter", () => {
  it("receipts a deterministic 541-office artifact and preserves vacancy-only staging", async () => {
    const root = await mkdtemp(join(tmpdir(), "identity-adapter-")); roots.push(root);
    const [house, senate, starts] = await Promise.all(["house-member-data.xml", "senate-members.xml", "senate-service-starts.json"].map(name => readFile(join(process.cwd(), "data/source/identity", name))));
    const input = (bytes: Uint8Array, url: string, lockId: string) => ({ bytes, url, checksumSha256: digest(bytes), lockId });
    const senateUniverse: SenateSeat[] = parseSenateRoster(senate.toString(), parseSenateServiceStartsArtifact(starts.toString())).records.map(row => ({ stateCode: row.office.stateCode, senateClass: row.office.senateClass! }));
    expect(house.byteLength).toBeLessThanOrEqual(IDENTITY_ARTIFACT_LIMITS.houseBytes); expect(senate.byteLength).toBeLessThanOrEqual(IDENTITY_ARTIFACT_LIMITS.senateBytes); expect(starts.byteLength).toBeLessThanOrEqual(IDENTITY_ARTIFACT_LIMITS.senateServiceStartsBytes);
    const localeCompare = vi.spyOn(String.prototype, "localeCompare").mockImplementation(() => { throw new Error("locale ordering must not be used"); });
    const adapter = createIdentityAdapter({ rawStore: new LocalRawObjectStore(root), snapshotId: "snap_identity" as never, upstreamRelease: "119", parserVersion: "identity-v1", releaseCutoff: "2099-01-01", sourceLockSha256: "a".repeat(64), house: input(house, "https://house", "house-xml"), senate: input(senate, "https://senate", "senate-xml"), senateServiceStarts: input(starts, "https://starts", "senate-service-starts"), houseUniverse, senateUniverse, senatePolicy: { noSenateJurisdictions: new Set(["DC", "PR", "AS", "GU", "MP", "VI"]) } });
    localeCompare.mockRestore();
    const raw = (await collect(adapter.extract({ releaseId: "release" as never, sourceId: "identity" as never, cutoff: new Date("2026-01-01Z") })))[0]!;
    expect(decodeIdentityEnvelope(encodeIdentityEnvelope(raw.value))).toEqual(raw.value);
    const rows = (await collect(adapter.parse(raw))).map(x => x.kind === "row" ? x.row : null);
    expect(raw.expectedRecordCount).toBe(541); expect(raw.receipt.sha256).toBe(raw.snapshot.checksumSha256); expect(rows.filter(row => row?.vacancy)).toHaveLength(4); expect(rows.find(row => row?.vacancy)?.entityId).toMatch(/^__vacancy__:/);
    expect(rows.map(row => row?.sourceNaturalKey)).toEqual([...rows.map(row => row?.sourceNaturalKey)].sort((left, right) => Buffer.compare(Buffer.from(left!), Buffer.from(right!))));
    const sql: unknown[][] = []; const client = { query: async (query: string, values?: unknown[]) => { sql.push([query, values]); return { rows: [{ total: "541", offices: "541", house: "441", senate: "100", occupied: "537", unique_people: "537", vacancies: "4" }] }; } } as unknown as PoolClient;
    await adapter.stage(client, "run", rows.filter((row): row is NonNullable<typeof row> => !!row).slice(0, 2));
    expect(String(sql[0]![0])).toContain("unnest($2"); await expect(adapter.loadFromStage(client, "run", "release" as never)).rejects.toThrow("NATIONWIDE_FINALIZE_REQUIRED");
  });

  it("rejects mutations outside sparse stage rows using the replayed full-facts hash", async () => {
    const root = await mkdtemp(join(tmpdir(), "identity-adapter-")); roots.push(root);
    const [house, senate, starts] = await Promise.all(["house-member-data.xml", "senate-members.xml", "senate-service-starts.json"].map(name => readFile(join(process.cwd(), "data/source/identity", name))));
    const input = (bytes: Uint8Array, url: string, lockId: string) => ({ bytes, url, checksumSha256: digest(bytes), lockId });
    const senateUniverse: SenateSeat[] = parseSenateRoster(senate.toString(), parseSenateServiceStartsArtifact(starts.toString())).records.map(row => ({ stateCode: row.office.stateCode, senateClass: row.office.senateClass! }));
    const adapter = createIdentityAdapter({ rawStore: new LocalRawObjectStore(root), snapshotId: "snap_identity" as never, upstreamRelease: "119", parserVersion: "identity-v1", releaseCutoff: "2099-01-01", sourceLockSha256: "a".repeat(64), house: input(house, "https://house", "house-xml"), senate: input(senate, "https://senate", "senate-xml"), senateServiceStarts: input(starts, "https://starts", "senate-service-starts"), houseUniverse, senateUniverse, senatePolicy: { noSenateJurisdictions: new Set(["DC", "PR", "AS", "GU", "MP", "VI"]) } });
    const retained = (await collect(adapter.extract({ releaseId: "release" as never, sourceId: "identity" as never, cutoff: new Date("2026-01-01Z") })))[0]!.value;
    const altered = (component: "house" | "senate" | "senateServiceStarts", change: (text: string) => string): IdentityEnvelopeV1 => { const value = JSON.parse(JSON.stringify(retained)) as IdentityEnvelopeV1; const current = value.components[component]; const bytes = Buffer.from(change(Buffer.from(current.base64, "base64").toString("utf8"))); (value.components as Record<string, { base64: string; byteLength: number; checksumSha256: string }>)[component] = { ...current, base64: bytes.toString("base64"), byteLength: bytes.byteLength, checksumSha256: digest(bytes) }; return value; };
    expect(() => decodeIdentityEnvelope(encodeIdentityEnvelope(altered("house", text => text.replace(/<party>[^<]*/, "<party>Changed"))))).toThrow(/IDENTITY_ENVELOPE_(?:FACTS|REPLAY)_MISMATCH/);
    expect(() => decodeIdentityEnvelope(encodeIdentityEnvelope(altered("house", text => text.replace(/(<sworn-date date=")\d{8}/, "$120190103"))))).toThrow(/IDENTITY_ENVELOPE_(?:FACTS|REPLAY)_MISMATCH/);
    expect(() => decodeIdentityEnvelope(encodeIdentityEnvelope(altered("senate", text => text.replace("Class I", "Class II"))))).toThrow();
    const changedRow = JSON.parse(JSON.stringify(retained)) as IdentityEnvelopeV1;
    (changedRow.rows as IdentityStageRow[])[0] = { ...changedRow.rows[0]!, displayName: "Changed" };
    expect(() => decodeIdentityEnvelope(encodeIdentityEnvelope(changedRow))).toThrow(/IDENTITY_ENVELOPE_(?:FACTS|REPLAY)_MISMATCH/);
    const changedUniverse = JSON.parse(JSON.stringify(retained)) as IdentityEnvelopeV1;
    (changedUniverse.houseUniverse as HouseSeat[])[0] = { ...(changedUniverse.houseUniverse[0]!), termEndsAt: "2027-01-04" };
    expect(() => decodeIdentityEnvelope(encodeIdentityEnvelope(changedUniverse))).toThrow(/IDENTITY_ENVELOPE_(?:FACTS|REPLAY)_MISMATCH/);
    const changedPolicy = JSON.parse(JSON.stringify(retained)) as IdentityEnvelopeV1;
    (changedPolicy.senatePolicy.noSenateJurisdictions as string[]).pop();
    expect(() => decodeIdentityEnvelope(encodeIdentityEnvelope(changedPolicy))).toThrow();
    const missingHash = JSON.parse(JSON.stringify(retained)) as Record<string, unknown>; delete missingHash.compiledFactsSha256;
    expect(() => decodeIdentityEnvelope(Buffer.from(JSON.stringify(missingHash)))).toThrow("IDENTITY_ENVELOPE_UNKNOWN_FIELD");
  });
});
