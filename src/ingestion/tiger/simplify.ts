/** Offline-only, deterministic whole-layer simplification for CD119 map artifacts. */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { NATIONWIDE_SEAT_POLICY } from "@/domain/validate-manifest";
import { TIGER_2025_JURISDICTIONS } from "./national";

type Position = readonly [number, number];
type Ring = readonly Position[];
type MultiPolygon = readonly (readonly Ring[])[];
type Feature = { readonly type: "Feature"; readonly properties: Record<string, unknown>; readonly geometry: { readonly type: "Polygon" | "MultiPolygon"; readonly coordinates: unknown } };
type Collection = { readonly type: "FeatureCollection"; readonly features: readonly Feature[] };
type Mapshaper = { applyCommands(argv: string, input: Record<string, string>, callback: (error: Error | null, output?: Record<string, Buffer>) => void): void };
const mapshaper = createRequire(import.meta.url)("mapshaper") as Mapshaper;

/** Fixed DP interval and export precision are deliberately part of the artifact contract. */
export const TIGER_SIMPLIFY_INTERVAL_METRES = 25;
export const TIGER_SIMPLIFY_PRECISION_DECIMALS = 6;
/** 150 m conservatively covers the retained 25 m DP run after projection and rounding. */
export const TIGER_SIMPLIFY_MAX_SYMMETRIC_ERROR_METRES = 150;
/** Conservative ceilings for the retained 93 MB, 4.05 M-vertex national layer. */
export const TIGER_SIMPLIFY_MAX_INPUT_BYTES = 128 * 1024 * 1024;
export const TIGER_SIMPLIFY_MAX_VERTICES = 5_000_000;
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const fail = (message: string): never => { throw new Error(`TIGER simplifier: ${message}`); };

export interface SimplifiedTigerLayer {
  /** Exact locked TIGER artifact bytes; finalization replays this pinned input. */
  readonly sourceBytes: Uint8Array;
  /** Bytewise GEOID-ascending; an array avoids JavaScript numeric-property reordering. */
  readonly districts: readonly { readonly geoid: string; readonly bytes: Uint8Array }[];
  readonly metrics: { readonly sourceSha256: string; readonly outputSha256: string; readonly featureCount: 441; readonly sourceVertices: number; readonly outputVertices: number; readonly vertexReduction: number; readonly maxSymmetricVertexBoundaryMetres: number; readonly adjacencyPairCount: number };
}
export interface SimplifyNationalTigerOptions { readonly expectedSourceSha256?: string; }

function expectedGeoids(): string[] {
  const nonVoting = new Set(["DC", "AS", "GU", "MP", "PR", "VI"]);
  return Object.entries(TIGER_2025_JURISDICTIONS).flatMap(([fips, code]) => {
    const seats = NATIONWIDE_SEAT_POLICY[code as keyof typeof NATIONWIDE_SEAT_POLICY]?.[0] ?? 1;
    return Array.from({ length: seats }, (_, index) => `${fips}${nonVoting.has(code) ? "98" : seats === 1 ? "00" : String(index + 1).padStart(2, "0")}`);
  }).sort(compare);
}
const EXPECTED_GEOIDS = expectedGeoids();

function number(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function geometry(value: unknown, key: string): MultiPolygon {
  if (!value || typeof value !== "object") fail(`${key}: geometry missing`);
  const raw = value as { type?: unknown; coordinates?: unknown };
  if ((raw.type !== "Polygon" && raw.type !== "MultiPolygon") || !Array.isArray(raw.coordinates)) fail(`${key}: geometry must be Polygon or MultiPolygon`);
  const polygons: unknown[] = raw.type === "Polygon" ? [raw.coordinates] : raw.coordinates as unknown[];
  if (!polygons.length) fail(`${key}: empty geometry`);
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || !polygon.length) fail(`${key}: empty polygon`);
    for (const candidate of polygon as unknown[]) {
      if (!Array.isArray(candidate) || candidate.length < 4) fail(`${key}: invalid ring`);
      const ring = candidate as unknown[];
      for (const point of ring) if (!Array.isArray(point) || point.length !== 2 || !number(point[0]) || !number(point[1]) || point[0] < -180 || point[0] > 180 || point[1] < -90 || point[1] > 90) fail(`${key}: invalid WGS84 coordinate`);
      const first = ring[0] as Position; const last = ring[ring.length - 1] as Position;
      if (first[0] !== last[0] || first[1] !== last[1]) fail(`${key}: ring is not closed`);
    }
  }
  return polygons as MultiPolygon;
}
function vertices(value: MultiPolygon): number { return value.reduce((total, polygon) => total + polygon.reduce((n, ring) => n + ring.length - 1, 0), 0); }
function winding(ring: Ring): number { let area = 0; for (let i = 1; i < ring.length; i++) area += ring[i - 1]![0] * ring[i]![1] - ring[i]![0] * ring[i - 1]![1]; return Math.sign(area); }
function segmentKey(a: Position, b: Position): string { const point = (p: Position) => `${Math.round(p[0] * 10 ** TIGER_SIMPLIFY_PRECISION_DECIMALS)},${Math.round(p[1] * 10 ** TIGER_SIMPLIFY_PRECISION_DECIMALS)}`; const x = point(a); const y = point(b); return x < y ? `${x}|${y}` : `${y}|${x}`; }
function adjacency(features: readonly { geoid: string; geometry: MultiPolygon }[]): Set<string> {
  const owners = new Map<string, string | string[]>();
  const pairs = new Set<string>();
  const addPair = (a: string, b: string) => { if (a !== b) pairs.add(a < b ? `${a}|${b}` : `${b}|${a}`); };
  for (const feature of features) for (const polygon of feature.geometry) for (const ring of polygon) for (let i = 1; i < ring.length; i++) {
    const key = segmentKey(ring[i - 1]!, ring[i]!); const prior = owners.get(key);
    if (prior === undefined) owners.set(key, feature.geoid);
    else if (typeof prior === "string") { addPair(prior, feature.geoid); if (prior !== feature.geoid) owners.set(key, [prior, feature.geoid]); }
    else if (!prior.includes(feature.geoid)) { for (const owner of prior) addPair(owner, feature.geoid); prior.push(feature.geoid); }
  }
  return pairs;
}
function pointSegmentMetres(p: Position, a: Position, b: Position): number { const scale = 111_320 * Math.cos(p[1] * Math.PI / 180); const px = p[0] * scale, py = p[1] * 110_574, ax = a[0] * scale, ay = a[1] * 110_574, bx = b[0] * scale, by = b[1] * 110_574; const dx = bx - ax, dy = by - ay; const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)); }
type Segment = { readonly a: Position; readonly b: Position; readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number };
type BoundaryIndex = { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number; readonly segments?: readonly Segment[]; readonly left?: BoundaryIndex; readonly right?: BoundaryIndex };
function segments(geometry: MultiPolygon): Segment[] { const result: Segment[] = []; for (const polygon of geometry) for (const ring of polygon) for (let i = 1; i < ring.length; i++) { const a = ring[i - 1]!, b = ring[i]!; result.push({ a, b, minX: Math.min(a[0], b[0]), minY: Math.min(a[1], b[1]), maxX: Math.max(a[0], b[0]), maxY: Math.max(a[1], b[1]) }); } return result; }
function indexBoundary(items: Segment[]): BoundaryIndex {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const item of items) { minX = Math.min(minX, item.minX); minY = Math.min(minY, item.minY); maxX = Math.max(maxX, item.maxX); maxY = Math.max(maxY, item.maxY); }
  if (items.length <= 16) return { minX, minY, maxX, maxY, segments: items };
  const horizontal = maxX - minX >= maxY - minY; items.sort((a, b) => (horizontal ? a.minX + a.maxX - b.minX - b.maxX : a.minY + a.maxY - b.minY - b.maxY));
  const middle = items.length >> 1;
  return { minX, minY, maxX, maxY, left: indexBoundary(items.slice(0, middle)), right: indexBoundary(items.slice(middle)) };
}
function boxDistanceMetres(point: Position, node: BoundaryIndex): number { const x = Math.max(node.minX, Math.min(point[0], node.maxX)), y = Math.max(node.minY, Math.min(point[1], node.maxY)); const longitudeScale = 111_320 * Math.cos(Math.max(Math.abs(point[1]), Math.abs(node.minY), Math.abs(node.maxY)) * Math.PI / 180); return Math.hypot((point[0] - x) * longitudeScale, (point[1] - y) * 110_574); }
function boundaryDistance(point: Position, index: BoundaryIndex): number { let nearest = Infinity; const visit = (node: BoundaryIndex): void => { if (boxDistanceMetres(point, node) >= nearest) return; if (node.segments) { for (const segment of node.segments) nearest = Math.min(nearest, pointSegmentMetres(point, segment.a, segment.b)); return; } const left = node.left!, right = node.right!; if (boxDistanceMetres(point, left) < boxDistanceMetres(point, right)) { visit(left); visit(right); } else { visit(right); visit(left); } }; visit(index); return nearest; }
function maxDistance(source: MultiPolygon, target: BoundaryIndex): number { let max = 0; for (const polygon of source) for (const ring of polygon) for (let i = 0; i < ring.length - 1; i++) max = Math.max(max, boundaryDistance(ring[i]!, target)); return max; }
function maxSymmetricDistance(a: MultiPolygon, b: MultiPolygon): number { return Math.max(maxDistance(a, indexBoundary(segments(b))), maxDistance(b, indexBoundary(segments(a)))); }
function maxRingSymmetricDistance(a: Ring, b: Ring): number {
  const asPolygon: MultiPolygon = [[a]], bsPolygon: MultiPolygon = [[b]];
  return maxSymmetricDistance(asPolygon, bsPolygon);
}
/** Positional correspondence guard: unlike whole-feature error this detects reordered components. */
export function correspondingGeometryError(source: MultiPolygon, output: MultiPolygon): number {
  if (source.length !== output.length) return Infinity;
  let maximum = 0;
  for (let polygon = 0; polygon < source.length; polygon++) {
    if (source[polygon]!.length !== output[polygon]!.length) return Infinity;
    for (let ring = 0; ring < source[polygon]!.length; ring++) maximum = Math.max(maximum, maxRingSymmetricDistance(source[polygon]![ring]!, output[polygon]![ring]!));
  }
  return maximum;
}
function canonical(geometry: MultiPolygon): Uint8Array { return Buffer.from(JSON.stringify({ type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: geometry } }) + "\n"); }
function run(command: string, input: string): Promise<Record<string, Buffer>> { return new Promise((resolve, reject) => mapshaper.applyCommands(command, { "districts.geojson": input }, (error, output) => error || !output ? reject(error ?? new Error("no mapshaper output")) : resolve(output))); }

export async function simplifyNationalTigerDistrictLayer(input: unknown, options: SimplifyNationalTigerOptions = {}): Promise<SimplifiedTigerLayer> {
  const inputBytes = Buffer.isBuffer(input) || input instanceof Uint8Array;
  const serialized = typeof input === "string" ? input : inputBytes ? Buffer.from(input).toString("utf8") : JSON.stringify(input);
  const sourceBytes = typeof input === "string" ? Buffer.from(input) : inputBytes ? input : Buffer.from(serialized);
  if (sourceBytes.byteLength > TIGER_SIMPLIFY_MAX_INPUT_BYTES) fail("input exceeds resource limit");
  const sourceSha256 = sha256(sourceBytes); if (options.expectedSourceSha256 !== undefined && (!/^[a-f0-9]{64}$/.test(options.expectedSourceSha256) || options.expectedSourceSha256 !== sourceSha256)) fail("source checksum mismatch");
  let parsedInput: unknown; try { parsedInput = typeof input === "string" || inputBytes ? JSON.parse(serialized) : input; } catch { fail("invalid JSON source"); }
  if (!parsedInput || typeof parsedInput !== "object" || (parsedInput as { type?: unknown }).type !== "FeatureCollection" || !Array.isArray((parsedInput as { features?: unknown }).features)) fail("not a FeatureCollection");
  const sourceProperty = (parsedInput as Collection).features[0]?.properties?.GEOID !== undefined ? "GEOID" : "sourceGeoid";
  const source = (parsedInput as Collection).features.map((feature, index) => { const geoid: unknown = feature?.properties?.[sourceProperty]; if (feature?.type !== "Feature" || typeof geoid !== "string") fail(`feature ${index}: controlled GEOID missing`); return { geoid: geoid as string, geometry: geometry(feature.geometry, `feature ${index}`) }; });
  if (source.length !== 441 || source.some((row, i) => row.geoid !== EXPECTED_GEOIDS[i])) fail("requires exact ascending 441-feature CD119 GEOID closure");
  const sourceVertices = source.reduce((n, row) => n + vertices(row.geometry), 0); if (sourceVertices > TIGER_SIMPLIFY_MAX_VERTICES) fail("input exceeds vertex resource limit");
  const sourcePairs = adjacency(source);
  const command = `-i districts.geojson -filter-fields ${sourceProperty} -simplify dp interval=${TIGER_SIMPLIFY_INTERVAL_METRES}m keep-shapes -o format=geojson precision=${10 ** -TIGER_SIMPLIFY_PRECISION_DECIMALS}`;
  const output = await run(command, serialized); const bytes = output["districts.json"]; if (!bytes || bytes.length > TIGER_SIMPLIFY_MAX_INPUT_BYTES) fail("mapshaper output resource limit");
  const parsed = JSON.parse(bytes.toString("utf8")) as Collection;
  if (parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features) || parsed.features.length !== 441) fail("mapshaper changed feature closure");
  const simplified = parsed.features.map((feature, index) => { const geoid: unknown = feature?.properties?.[sourceProperty]; if (!feature.properties || Object.keys(feature.properties).length !== 1 || typeof geoid !== "string") fail("mapshaper retained uncontrolled properties"); if (geoid !== EXPECTED_GEOIDS[index]) fail("mapshaper changed GEOID ordering"); return { geoid: geoid as string, geometry: geometry(feature.geometry, geoid as string) }; });
  for (let i = 0; i < source.length; i++) {
    const before = source[i]!, after = simplified[i]!;
    if (after.geometry.length !== before.geometry.length) fail(`${before.geoid}: polygon closure changed`);
    for (let polygonIndex = 0; polygonIndex < before.geometry.length; polygonIndex++) {
      const sourcePolygon = before.geometry[polygonIndex]!, outputPolygon = after.geometry[polygonIndex]!;
      if (outputPolygon.length !== sourcePolygon.length) fail(`${before.geoid}: ring closure changed`);
      for (let ringIndex = 0; ringIndex < sourcePolygon.length; ringIndex++) {
        const sourceRing = sourcePolygon[ringIndex]!, outputRing = outputPolygon[ringIndex]!;
        if (winding(outputRing) !== winding(sourceRing)) fail(`${before.geoid}: winding role changed`);
        if (maxRingSymmetricDistance(sourceRing, outputRing) > TIGER_SIMPLIFY_MAX_SYMMETRIC_ERROR_METRES) fail(`${before.geoid}: corresponding ring changed`);
      }
    }
  }
  const outputPairs = adjacency(simplified); if (sourcePairs.size !== outputPairs.size || [...sourcePairs].some((pair) => !outputPairs.has(pair))) fail("source adjacency-pair closure changed");
  let outputVertices = 0, maxError = 0;
  for (let i = 0; i < source.length; i++) { const before = source[i]!, after = simplified[i]!; outputVertices += vertices(after.geometry); maxError = Math.max(maxError, maxSymmetricDistance(before.geometry, after.geometry), correspondingGeometryError(before.geometry, after.geometry)); }
  if (outputVertices >= sourceVertices) fail("simplification did not reduce vertices"); if (maxError > TIGER_SIMPLIFY_MAX_SYMMETRIC_ERROR_METRES) fail(`post-rounding symmetric error ${maxError}m exceeds tolerance`);
  const districts = simplified.map((row) => ({ geoid: row.geoid, bytes: canonical(row.geometry) })); const joined = Buffer.concat(districts.flatMap(({ geoid, bytes: value }) => [Buffer.from(`${geoid}\n`), Buffer.from(value)]));
  return { sourceBytes: Buffer.from(sourceBytes), districts, metrics: { sourceSha256, outputSha256: sha256(joined), featureCount: 441, sourceVertices, outputVertices, vertexReduction: sourceVertices - outputVertices, maxSymmetricVertexBoundaryMetres: maxError, adjacencyPairCount: sourcePairs.size } };
}
