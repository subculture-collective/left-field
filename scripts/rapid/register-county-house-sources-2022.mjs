import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const COMMIT = "01d954bc3590476ca56eb16fcb7c50224967b665";
const states = "ak al ar az ca co ct dc de fl ga hi ia id il in ks ky la ma md me mi mn mo ms mt nc nd ne nh nj nm nv ny oh ok or pa ri sc sd tn tx ut va vt wa wi wv wy".split(" ");
const root = process.cwd();
const lockPath = join(root, "data/source-lock.json");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const lock = JSON.parse(await readFile(lockPath, "utf8"));
if (lock.version !== 1 || !Array.isArray(lock.entries)) throw new Error("COUNTY_HOUSE_2022_SOURCE_LOCK_INVALID");
const additions = [];
let replacements = 0;
for (const state of states) {
  const id = `medsl-2022-house-state-${state}`;
  const retainedPath = `data/source/rapid/county-house-results/2022/2022-${state}-local-precinct-general.zip`;
  const bytes = await readFile(join(root, retainedPath));
  const expected = {
    id,
    url: `https://raw.githubusercontent.com/MEDSL/2022-elections-official/${COMMIT}/individual_states/2022-${state}-local-precinct-general.zip`,
    retainedPath,
    retainedStatus: "retained",
    byteSize: bytes.length,
    sha256: sha256(bytes),
    kind: "source",
    parentIds: [],
  };
  const existing = lock.entries.filter((entry) => entry.id === id || entry.retainedPath === retainedPath);
  if (existing.length > 1 || (existing.length === 1 && JSON.stringify(existing[0]) !== JSON.stringify(expected))) throw new Error(`COUNTY_HOUSE_2022_SOURCE_LOCK_CONFLICT:${id}`);
  if (existing.length === 0) additions.push(expected);
}
const projectionPath = "data/metadata/rapid-county-house-results-2022-projection-v1.json";
try {
  const bytes = await readFile(join(root, projectionPath));
  const expected = {
    id: "rapid-county-house-results-2022-projection-v1",
    url: "urn:dsa-seats:rapid-county-house-results-2022-projection:v1:2022",
    retainedPath: projectionPath,
    retainedStatus: "retained",
    byteSize: bytes.length,
    sha256: sha256(bytes),
    kind: "derived_artifact",
    parentIds: [...states.map((state) => `medsl-2022-house-state-${state}`), "rapid-county-demographics-projection-v1"],
  };
  const existing = lock.entries.filter((entry) => entry.id === expected.id || entry.retainedPath === projectionPath);
  if (existing.length > 1 || (existing.length === 1 && (existing[0].id !== expected.id || existing[0].retainedPath !== projectionPath))) throw new Error("COUNTY_HOUSE_2022_OUTPUT_LOCK_CONFLICT");
  if (existing.length === 0) additions.push(expected);
  else if (JSON.stringify(existing[0]) !== JSON.stringify(expected)) { lock.entries[lock.entries.indexOf(existing[0])] = expected; replacements++; }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
const coveragePath = "data/metadata/rapid-local-context-coverage-v4.json";
try {
  const bytes = await readFile(join(root, coveragePath));
  const expected = {
    id: "rapid-local-context-coverage-v4",
    url: "urn:dsa-seats:rapid-local-context-coverage:v4:2026-08-08",
    retainedPath: coveragePath,
    retainedStatus: "retained",
    byteSize: bytes.length,
    sha256: sha256(bytes),
    kind: "evidence_receipt",
    parentIds: ["rapid-county-demographics-projection-v1", "rapid-county-election-context-projection-v1", "rapid-county-house-results-2022-projection-v1", "rapid-county-house-results-projection-v1", "rapid-county-senate-results-projection-v1", "rapid-indiana-state-legislative-primary-results-v1"],
  };
  const existing = lock.entries.filter((entry) => entry.id === expected.id || entry.retainedPath === coveragePath);
  if (existing.length > 1 || (existing.length === 1 && JSON.stringify(existing[0]) !== JSON.stringify(expected))) throw new Error("COUNTY_HOUSE_2022_COVERAGE_LOCK_CONFLICT");
  if (existing.length === 0) additions.push(expected);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
if (additions.length || replacements) {
  lock.entries.push(...additions);
  const serialized = `{\n  \"version\": 1,\n  \"entries\": [\n    ${lock.entries.map((entry) => JSON.stringify(entry)).join(",\n    ")}\n  ]\n}\n`;
  await writeFile(lockPath, serialized, { flag: "w" });
}
process.stdout.write(`${JSON.stringify({ registered: additions.length, replaced: replacements, total: states.length })}\n`);
