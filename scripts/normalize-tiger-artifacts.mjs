import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const names = ["tiger2025-ak-cd119-selected.geojson", "tiger2025-al-cd119-selected.geojson", "tiger2025-az-cd119-selected.geojson", "tiger2025-fl-cd119-selected.geojson", "tiger2025-selected-states.geojson"];
const [inputRoot = "data/geometry", outputRoot = inputRoot] = process.argv.slice(2);
const input = resolve(inputRoot); const output = resolve(outputRoot);

function fail(message) { throw new Error(message); }
function bytewiseLexicalCompare(left, right) { return left < right ? -1 : left > right ? 1 : 0; }
function multiPolygon(geometry, name) {
  if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") || !Array.isArray(geometry.coordinates)) fail(`${name}: geometry must be Polygon or MultiPolygon`);
  return geometry.type === "Polygon" ? { type: "MultiPolygon", coordinates: [geometry.coordinates] } : geometry;
}
function normalizedProperties(properties, name) {
  if (!properties || typeof properties !== "object") fail(`${name}: missing properties`);
  if ("sourceGeoid" in properties) {
    const keys = Object.keys(properties).sort(bytewiseLexicalCompare); const expected = (properties.districtCode === null ? ["districtCode", "sourceGeoid", "stateCode", "stateFips"] : ["districtCode", "label", "sourceGeoid", "stateCode", "stateFips"]).sort(bytewiseLexicalCompare);
    if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) fail(`${name}: invalid canonical properties`);
    if (typeof properties.sourceGeoid !== "string" || typeof properties.stateFips !== "string" || (typeof properties.districtCode !== "string" && properties.districtCode !== null) || (typeof properties.stateCode !== "string" && properties.stateCode !== null) || (properties.districtCode !== null && typeof properties.label !== "string")) fail(`${name}: invalid canonical property values`);
    return { ...properties, districtCode: properties.stateFips === "02" && properties.districtCode === "00" ? "AL" : properties.districtCode };
  }
  for (const key of ["GEOID", "STATEFP"]) if (typeof properties[key] !== "string") fail(`${name}: missing raw ${key}`);
  if (!(typeof properties.CD119FP === "string" || properties.CD119FP === undefined)) fail(`${name}: invalid raw CD119FP`);
  if (!(typeof properties.STUSPS === "string" || properties.STUSPS === undefined)) fail(`${name}: invalid raw STUSPS`);
  if (properties.CD119FP === undefined) {
    if (typeof properties.STUSPS !== "string") fail(`${name}: missing raw STUSPS`);
    return { sourceGeoid: properties.GEOID, stateFips: properties.STATEFP, districtCode: null, stateCode: properties.STUSPS };
  }
  if (typeof properties.NAMELSAD !== "string") fail(`${name}: missing raw NAMELSAD`);
  return { sourceGeoid: properties.GEOID, stateFips: properties.STATEFP, districtCode: properties.STATEFP === "02" && properties.CD119FP === "00" ? "AL" : properties.CD119FP, stateCode: properties.STUSPS ?? null, label: properties.NAMELSAD };
}

await mkdir(output, { recursive: true });
for (const name of names) {
  const source = resolve(input, basename(name));
  const collection = JSON.parse(await readFile(source, "utf8"));
  if (!collection || collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) fail(`${name}: not a FeatureCollection`);
  const features = collection.features.map((feature, index) => {
    if (!feature || feature.type !== "Feature") fail(`${name}: invalid feature ${index}`);
    return { type: "Feature", properties: normalizedProperties(feature.properties, `${name} feature ${index}`), geometry: multiPolygon(feature.geometry, `${name} feature ${index}`) };
  }).sort((a, b) => bytewiseLexicalCompare(a.properties.sourceGeoid, b.properties.sourceGeoid));
  if (new Set(features.map((feature) => feature.properties.sourceGeoid)).size !== features.length) fail(`${name}: duplicate GEOID`);
  const destination = resolve(output, basename(name));
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify({ type: "FeatureCollection", features })}\n`);
  await rename(temporary, destination);
}
