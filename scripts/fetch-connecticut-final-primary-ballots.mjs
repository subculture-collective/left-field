import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const catalogPath = new URL("../data/source/elections/primary-results/connecticut/ballots/source-catalog-v1.json", import.meta.url);
const catalogBytes = await readFile(catalogPath);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
if (sha(catalogBytes) !== "746dba8bf3f7f4e47e776a47d63f876be496f6faa0e7101e31b0a68a5da410ca") throw new Error("CT_FINAL_PRIMARY_BALLOT_CATALOG_DRIFT");
const catalog = JSON.parse(catalogBytes.toString("utf8"));
if (catalog.schema !== "connecticut-final-primary-ballot-source-catalog-v1" || catalog.version !== 1 || catalog.indexes.length !== 2 || catalog.documents.length !== 196 || catalog.townRows.length !== 338) throw new Error("CT_FINAL_PRIMARY_BALLOT_CATALOG_INVALID");

const sources = [
  ...catalog.indexes.map((source) => ({ id: source.id, url: source.url, retainedPath: source.retainedPath, byteSize: source.byteSize, sha256: source.sha256, cacheName: `${source.id}.bin`, kind: "official_primary_ballot_index" })),
  ...catalog.documents.map((source) => ({ id: source.sourceLockId, url: source.url, retainedPath: source.retainedPath, byteSize: source.byteSize, sha256: source.sha256, cacheName: `${source.sourceLockId}.pdf`, kind: "official_primary_ballot" })),
];
if (new Set(sources.map((source) => source.id)).size !== 198 || new Set(sources.map((source) => source.url)).size !== 198 || new Set(sources.map((source) => source.retainedPath)).size !== 198) throw new Error("CT_FINAL_PRIMARY_BALLOT_SOURCE_UNIVERSE_INVALID");

if (process.env.DSA_SEATS_CT_FINAL_PRIMARY_BALLOTS_DESCRIBE === "1") {
  process.stdout.write(`${JSON.stringify({ verifiedSources: sources.length, retainedSources: sources.length, indexSources: catalog.indexes.length, ballotSources: catalog.documents.length, townRows: catalog.townRows.length, cycles: catalog.indexes.map((source) => ({ cycleYear: source.cycleYear, townRows: source.townRows, democraticBallotLinks: source.democraticBallotLinks })) })}\n`);
  process.exit(0);
}

const cache = process.env.DSA_SEATS_CT_FINAL_PRIMARY_BALLOTS_CACHE_DIR;
for (const source of sources) {
  const bytes = cache
    ? await readFile(resolve(cache, source.cacheName))
    : Buffer.from(await (await fetch(source.url, { signal: AbortSignal.timeout(120000), headers: { "user-agent": "dsa-seats-source-lock/1.0" } })).arrayBuffer());
  if (bytes.length !== source.byteSize || sha(bytes) !== source.sha256) throw new Error(`CT_FINAL_PRIMARY_BALLOT_SOURCE_DRIFT:${source.id}`);
  const target = resolve(source.retainedPath);
  await mkdir(dirname(target), { recursive: true });
  try { await writeFile(target, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if (error.code !== "EEXIST" || !(await readFile(target)).equals(bytes)) throw new Error(`CT_FINAL_PRIMARY_BALLOT_OUTPUT_CONFLICT:${source.id}`); }
}
process.stdout.write(`${JSON.stringify({ verifiedSources: sources.length, retainedSources: sources.length })}\n`);
