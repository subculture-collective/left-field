import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NATIONWIDE_SEAT_POLICY } from "@/domain/validate-manifest";
import { TIGER_2025_JURISDICTIONS } from "./national";
import { correspondingGeometryError, simplifyNationalTigerDistrictLayer, TIGER_SIMPLIFY_MAX_SYMMETRIC_ERROR_METRES } from "./simplify";

function geoids(): string[] {
  const nonVoting = new Set(["DC", "AS", "GU", "MP", "PR", "VI"]);
  return Object.entries(TIGER_2025_JURISDICTIONS).flatMap(([fips, state]) => {
    const seats = NATIONWIDE_SEAT_POLICY[state as keyof typeof NATIONWIDE_SEAT_POLICY]?.[0] ?? 1;
    return Array.from({ length: seats }, (_, index) => `${fips}${nonVoting.has(state) ? "98" : seats === 1 ? "00" : String(index + 1).padStart(2, "0")}`);
  }).sort();
}
const ids = geoids();
const winding = (ring: number[][]) => Math.sign(ring.slice(1).reduce((area, point, index) => area + ring[index]![0] * point[1] - point[0] * ring[index]![1], 0));
function fixture() {
  return { type: "FeatureCollection" as const, features: ids.map((GEOID, index) => {
    const x = -170 + (index % 21) * .1, y = -50 + Math.floor(index / 21) * .1, z = .1;
    // Mid-edge vertices make a real, topology-wide DP reduction while neighboring cells share arcs.
    const ring = [[x, y], [x + z / 2, y], [x + z, y], [x + z, y + z / 2], [x + z, y + z], [x + z / 2, y + z], [x, y + z], [x, y + z / 2], [x, y]];
    return { type: "Feature" as const, properties: { GEOID, incidental: "must disappear" }, geometry: { type: "Polygon" as const, coordinates: [ring] } };
  }) };
}

describe("whole-layer TIGER simplifier", () => {
  it("simplifies the exact nationwide layer deterministically and emits property-free canonical district bytes", async () => {
    const input = fixture();
    const first = await simplifyNationalTigerDistrictLayer(input);
    const second = await simplifyNationalTigerDistrictLayer(input);
    expect(first).toEqual(second);
    expect(first.districts.map((district) => district.geoid)).toEqual(ids);
    expect(first.metrics).toMatchObject({ featureCount: 441, adjacencyPairCount: expect.any(Number) });
    expect(first.metrics.outputVertices).toBeLessThan(first.metrics.sourceVertices);
    expect(first.metrics.vertexReduction).toBeGreaterThan(0);
    expect(first.metrics.maxSymmetricVertexBoundaryMetres).toBeLessThanOrEqual(1_500);
    expect(JSON.parse(Buffer.from(first.districts[0]!.bytes).toString("utf8"))).toMatchObject({ properties: {}, geometry: { type: "MultiPolygon" } });
  }, 30_000);

  it("fails closed for non-exact closure and invalid rings", async () => {
    const missing = fixture(); missing.features.pop();
    await expect(simplifyNationalTigerDistrictLayer(missing)).rejects.toThrow("441-feature");
    const unclosed = fixture(); unclosed.features[0]!.geometry.coordinates[0]![8] = [-1, -1];
    await expect(simplifyNationalTigerDistrictLayer(unclosed)).rejects.toThrow("not closed");
    await expect(simplifyNationalTigerDistrictLayer(fixture(), { expectedSourceSha256: "0".repeat(64) })).rejects.toThrow("checksum mismatch");
  }, 30_000);

  it("rejects adversarially swapped positional polygons and rings", () => {
    const square = (x: number, y: number) => [[x, y], [x, y + .01], [x + .01, y + .01], [x, y]] as const;
    const source = [[square(0, 0), square(.002, .002)], [square(1, 1)]] as const;
    expect(correspondingGeometryError(source, [source[1]!, source[0]!])).toBeGreaterThan(TIGER_SIMPLIFY_MAX_SYMMETRIC_ERROR_METRES);
    expect(correspondingGeometryError(source, [[source[0]![1]!, source[0]![0]!], source[1]!])).toBeGreaterThan(TIGER_SIMPLIFY_MAX_SYMMETRIC_ERROR_METRES);
  });

  it("processes the retained national source within conservative limits", async () => {
    const source = await readFile(resolve(process.cwd(), "data/geometry/versions/9a5e76fc39867c92b0c816e4b23ca9c467d070c1eafbef6d0988b24e480c4871/tiger2025-national-cd119.geojson"));
    const result = await simplifyNationalTigerDistrictLayer(source, { expectedSourceSha256: "66a71a6b18689748f53acbc8c3e51eae41a10558cf7a8aebebe4cdeaba973cf6" });
    expect(result.districts).toHaveLength(441);
    expect(result.districts.map((district) => district.geoid)).toEqual(ids);
    expect(result.metrics).toEqual({ sourceSha256: "66a71a6b18689748f53acbc8c3e51eae41a10558cf7a8aebebe4cdeaba973cf6", outputSha256: "98abc93f62a0af3f30351ec52c09c7d8f2cddb9ea7653e92e30b79c48ee5f1ff", featureCount: 441, sourceVertices: 4_049_004, outputVertices: 452_334, vertexReduction: 3_596_670, maxSymmetricVertexBoundaryMetres: 39.84855589476526, adjacencyPairCount: 1169 });
    type SourceGeometry = { type: "Polygon"; coordinates: number[][][] } | { type: "MultiPolygon"; coordinates: number[][][][] };
    const input = JSON.parse(source.toString("utf8")) as { features: { geometry: SourceGeometry }[] };
    let polygonDifferences = 0, ringDifferences = 0, windingDifferences = 0;
    for (let index = 0; index < input.features.length; index++) {
      const before = input.features[index]!.geometry;
      const sourcePolygons = before.type === "Polygon" ? [before.coordinates] : before.coordinates;
      const after = JSON.parse(Buffer.from(result.districts[index]!.bytes).toString("utf8")).geometry.coordinates as number[][][][];
      polygonDifferences += Number(sourcePolygons.length !== after.length);
      for (let polygon = 0; polygon < sourcePolygons.length; polygon++) {
        const sourceRings = sourcePolygons[polygon]!, outputRings = after[polygon]!;
        ringDifferences += Number(sourceRings.length !== outputRings.length);
        for (let ring = 0; ring < sourceRings.length; ring++) windingDifferences += Number(winding(sourceRings[ring]!) !== winding(outputRings[ring]!));
      }
    }
    expect({ polygonDifferences, ringDifferences, windingDifferences }).toEqual({ polygonDifferences: 0, ringDifferences: 0, windingDifferences: 0 });
  }, 600_000);
});
