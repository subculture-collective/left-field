import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NATIONWIDE_SEAT_POLICY } from "@/domain/validate-manifest";
import { LocalRawObjectStore } from "../core/raw-object-store";
import { createTigerAdapter, TIGER_ARTIFACT_LIMITS } from "./adapter";
import { TIGER_2025_JURISDICTIONS, createNationalTigerManifest, parseNationalTigerArtifacts } from "./national";

const sha = (v: Uint8Array) => createHash("sha256").update(v).digest("hex"); const polygon = { type: "MultiPolygon", coordinates: [[[[0, 0], [1, 0], [0, 1], [0, 0]]]] }; const fips = Object.keys(TIGER_2025_JURISDICTIONS) as (keyof typeof TIGER_2025_JURISDICTIONS)[]; const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function collect<T>(items: AsyncIterable<T>): Promise<T[]> { const result: T[] = []; for await (const item of items) result.push(item); return result; }

describe("TIGER source adapter", () => {
  it("sets finite component limits above the retained national artifacts", () => {
    expect(TIGER_ARTIFACT_LIMITS.cd119Bytes).toBeGreaterThanOrEqual(93_269_640);
    expect(TIGER_ARTIFACT_LIMITS.statesBytes).toBeGreaterThanOrEqual(22_322_333);
    expect(TIGER_ARTIFACT_LIMITS.cd119Bytes).toBeLessThan(128 * 1024 * 1024);
    expect(TIGER_ARTIFACT_LIMITS.statesBytes).toBeLessThan(32 * 1024 * 1024);
    expect(TIGER_ARTIFACT_LIMITS.derivedEnvelopeBytes).toBeLessThanOrEqual(1024 * 1024);
  });
  it("receipts one deterministic envelope covering all 497 geometries", async () => {
    const states = { type: "FeatureCollection", features: fips.map(stateFips => ({ type: "Feature", properties: { sourceGeoid: stateFips, sourceDistrictCode: null, stateFips, stateCode: TIGER_2025_JURISDICTIONS[stateFips], districtCode: null }, geometry: polygon })).sort((a, b) => Buffer.compare(Buffer.from(a.properties.sourceGeoid), Buffer.from(b.properties.sourceGeoid))) };
    const cd119 = { type: "FeatureCollection", features: fips.flatMap(stateFips => { const stateCode = TIGER_2025_JURISDICTIONS[stateFips]; const seats = NATIONWIDE_SEAT_POLICY[stateCode as keyof typeof NATIONWIDE_SEAT_POLICY]?.[0] ?? 1; return Array.from({ length: seats }, (_, i) => { const sourceDistrictCode = ["DC", "AS", "GU", "MP", "PR", "VI"].includes(stateCode) ? "98" : seats === 1 ? "00" : String(i + 1).padStart(2, "0"); return { type: "Feature", properties: { sourceGeoid: `${stateFips}${sourceDistrictCode}`, sourceDistrictCode, stateFips, stateCode, districtCode: sourceDistrictCode === "00" || sourceDistrictCode === "98" ? "AL" : sourceDistrictCode, label: "District", cdSession: "119" }, geometry: polygon }; }); }).sort((a, b) => Buffer.compare(Buffer.from(a.properties.sourceGeoid), Buffer.from(b.properties.sourceGeoid))) };
    const cdBytes = Buffer.from(JSON.stringify(cd119)), stateBytes = Buffer.from(JSON.stringify(states)), parsed = parseNationalTigerArtifacts(cd119, states); const archives = Object.fromEntries([...fips.map(x => [`tl_2025_${x}_cd119.zip`, "a".repeat(64)]), ["tl_2025_us_state.zip", "a".repeat(64)]]); const manifest = createNationalTigerManifest(archives, sha(cdBytes), sha(stateBytes), parsed); const root = await mkdtemp(join(tmpdir(), "tiger-adapter-")); roots.push(root);
    const adapter = createTigerAdapter({ rawStore: new LocalRawObjectStore(root), snapshotId: "snap_tiger" as never, upstreamRelease: "2025", parserVersion: "tiger-v1", sourceLockSha256: "a".repeat(64), lockIds: { cd119: "geo-national-cd119", states: "geo-national-states", manifest: "geo-national-manifest", bundle: "geo-national-bundle" }, manifest, cd119Bytes: cdBytes, statesBytes: stateBytes, sourceUrl: "https://census" }); const raw = (await collect(adapter.extract({ releaseId: "release" as never, sourceId: "tiger" as never, cutoff: new Date() })))[0]!;
    expect(raw.expectedRecordCount).toBe(497); expect(raw.value.components.cd119.sha256).toBe(sha(cdBytes)); expect(raw.value.components.states.sha256).toBe(sha(stateBytes)); expect(Buffer.byteLength(JSON.stringify(raw.value))).toBeLessThanOrEqual(TIGER_ARTIFACT_LIMITS.derivedEnvelopeBytes); expect((await readdir(root, { recursive: true })).filter(entry => typeof entry === "string" && /\.(geojson|json)$/.test(entry))).toHaveLength(3); expect((await collect(adapter.parse(raw))).filter(x => x.kind === "row")).toHaveLength(497); const tampered = { ...raw, value: { ...raw.value, components: { ...raw.value.components, cd119: { ...raw.value.components.cd119, sha256: "0".repeat(64) } } } }; await expect(collect(adapter.parse(tampered))).rejects.toThrow(); await expect(adapter.loadFromStage({} as never, "run", "release" as never)).rejects.toThrow("NATIONWIDE_FINALIZE_REQUIRED");
  });
});
