import { describe, expect, it } from "vitest";
import { NATIONWIDE_SEAT_POLICY } from "@/domain/validate-manifest";
import { TIGER_2025_JURISDICTIONS, createNationalTigerManifest, normalizeRawNationalTigerCollection, parseNationalTigerArtifacts } from "./national";

const polygon = { type: "MultiPolygon", coordinates: [[[[0, 0], [1, 0], [0, 1], [0, 0]]]] };
const fips = Object.keys(TIGER_2025_JURISDICTIONS) as (keyof typeof TIGER_2025_JURISDICTIONS)[];
const states = { type: "FeatureCollection", features: fips.map((stateFips) => ({ type: "Feature", properties: { sourceGeoid: stateFips, sourceDistrictCode: null, stateFips, stateCode: TIGER_2025_JURISDICTIONS[stateFips], districtCode: null }, geometry: polygon })).sort((a, b) => a.properties.sourceGeoid.localeCompare(b.properties.sourceGeoid)) };
const cd = { type: "FeatureCollection", features: fips.flatMap((stateFips) => {
  const stateCode = TIGER_2025_JURISDICTIONS[stateFips]; const count = NATIONWIDE_SEAT_POLICY[stateCode as keyof typeof NATIONWIDE_SEAT_POLICY]?.[0] ?? 1;
  return Array.from({ length: count }, (_, index) => { const sourceDistrictCode = ["DC", "AS", "GU", "MP", "PR", "VI"].includes(stateCode) ? "98" : count === 1 ? "00" : String(index + 1).padStart(2, "0"); const districtCode = sourceDistrictCode === "00" || sourceDistrictCode === "98" ? "AL" : sourceDistrictCode; return { type: "Feature" as const, properties: { sourceGeoid: `${stateFips}${sourceDistrictCode}`, sourceDistrictCode, stateFips, stateCode, districtCode, label: "District", cdSession: "119" }, geometry: polygon }; });
}).sort((a, b) => a.properties.sourceGeoid.localeCompare(b.properties.sourceGeoid)) };

describe("national TIGER parser", () => {
  it("is deterministic and preserves raw GEOID while canonicalizing at-large", () => {
    const first = parseNationalTigerArtifacts(cd, states); expect(first).toEqual(parseNationalTigerArtifacts(cd, states));
    expect(first.cd119.find((row) => row.sourceGeoid === "0200")).toMatchObject({ sourceDistrictCode: "00", districtCode: "AL", stateCode: "AK" });
    expect(first.cd119.find((row) => row.sourceGeoid === "1198")).toMatchObject({ sourceDistrictCode: "98", districtCode: "AL", stateCode: "DC" });
  });
  it("rejects malformed GEOID/session, ordering, duplicate and state closure", () => {
    const bad = structuredClone(cd); bad.features[0].properties.cdSession = "118"; expect(() => parseNationalTigerArtifacts(bad, states)).toThrow("CDSESSN");
    const unordered = structuredClone(cd); [unordered.features[0], unordered.features[1]] = [unordered.features[1]!, unordered.features[0]!]; expect(() => parseNationalTigerArtifacts(unordered, states)).toThrow("ascending");
    const missing = structuredClone(states); missing.features.pop(); expect(() => parseNationalTigerArtifacts(cd, missing)).toThrow("expected 441");
  });
  it("rejects unclosed, out-of-range, and incomplete district geometry/closure", () => {
    const unclosed = structuredClone(cd); unclosed.features[0].geometry.coordinates[0][0][3] = [2, 2]; expect(() => parseNationalTigerArtifacts(unclosed, states)).toThrow("not closed");
    const outOfRange = structuredClone(states); outOfRange.features[0].geometry.coordinates[0][0][0] = [181, 0]; expect(() => parseNationalTigerArtifacts(cd, outOfRange)).toThrow("longitude");
    const missingDistrict = structuredClone(cd); missingDistrict.features.splice(0, 1); expect(() => parseNationalTigerArtifacts(missingDistrict, states)).toThrow("expected 441");
    const nan = structuredClone(states); nan.features[0].geometry.coordinates[0][0][0] = [Number.NaN, 0]; expect(() => parseNationalTigerArtifacts(cd, nan)).toThrow("longitude");
    const nesting = structuredClone(states); nesting.features[0].geometry.coordinates = [[]]; expect(() => parseNationalTigerArtifacts(cd, nesting)).toThrow("malformed polygon");
    const wrong = structuredClone(cd); const row = wrong.features.find((feature) => feature.properties.stateFips === "06")!; row.properties.districtCode = "99"; expect(() => parseNationalTigerArtifacts(wrong, states)).toThrow("GEOID");
  });
  it("creates a stable staging-compatible checksum manifest", () => {
    const parsed = parseNationalTigerArtifacts(cd, states); const archives = Object.fromEntries([...fips.map((stateFips) => [`tl_2025_${stateFips}_cd119.zip`, "a".repeat(64)]), ["tl_2025_us_state.zip", "a".repeat(64)]]); const manifest = createNationalTigerManifest(archives, "b".repeat(64), "c".repeat(64), parsed);
    expect(manifest).toMatchObject({ srid: 4326, artifacts: { cd119FeatureCount: 441, stateFeatureCount: 56 } });
  });
  it("derives CD state codes without STUSPS and rejects ZZ or wrong at-large semantics", () => {
    const raw = { type: "FeatureCollection", features: [{ type: "Feature", properties: { GEOID: "1198", STATEFP: "11", CD119FP: "98", CDSESSN: "119", NAMELSAD: "Delegate" }, geometry: polygon }] };
    expect(normalizeRawNationalTigerCollection(raw, "cd119")).toMatchObject({ features: [{ properties: { stateCode: "DC", sourceDistrictCode: "98", districtCode: "AL" } }] });
    const zz = structuredClone(cd); zz.features.find((row) => row.properties.stateFips === "09")!.properties.sourceDistrictCode = "ZZ"; expect(() => parseNationalTigerArtifacts(zz, states)).toThrow("GEOID/CDSESSN");
    const wrongAtLarge = structuredClone(cd); const dc = wrongAtLarge.features.find((row) => row.properties.stateFips === "11")!; dc.properties.sourceDistrictCode = "00"; dc.properties.sourceGeoid = "1100"; expect(() => parseNationalTigerArtifacts(wrongAtLarge, states)).toThrow("closure");
  });
});
