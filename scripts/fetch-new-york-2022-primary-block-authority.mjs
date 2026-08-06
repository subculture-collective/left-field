import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sources = [
  { id: "ny-latfor-2022-congressional-map-authority", url: "https://latfor.state.ny.us/maps/?sec=2022_congress", cacheName: "index.html", retainedPath: "data/source/elections/primary-results/geography/new-york/2022/latfor-2022-congressional-maps.html", byteSize: 7681, sha256: "a36754eead5ee7b3bc6263fa0b47ebd8867de035c46a6b385467dc5c5bf8aa92" },
  { id: "ny-2022-court-ordered-congressional-block-assignment", url: "https://latfor.state.ny.us/maps/congress2022/Congress22_AmendedTechnicalCorrections_June_02_2022.dbf", cacheName: "assignment.dbf", retainedPath: "data/source/elections/primary-results/geography/new-york/2022/court-ordered-congressional-block-assignment.dbf", byteSize: 6931754, sha256: "460c38cf2cbbc07172782a2f508e6ad80a96a00dd4d57e5c22f6af011d42f3e6" },
];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
if (process.env.DSA_SEATS_NY_2022_BLOCK_AUTHORITY_DESCRIBE === "1") { process.stdout.write(`${JSON.stringify({ verifiedSources: 2, retainedSources: 2, sources: sources.map(({ id, byteSize, sha256, retainedPath }) => ({ id, byteSize, sha256, retainedPath })) })}\n`); process.exit(0); }
const cache = process.env.DSA_SEATS_NY_2022_BLOCK_AUTHORITY_CACHE_DIR;
for (const source of sources) {
  const bytes = cache ? await readFile(resolve(cache, source.cacheName)) : Buffer.from(await (await fetch(source.url, { signal: AbortSignal.timeout(120000), headers: { "user-agent": "dsa-seats-source-lock/1.0" } })).arrayBuffer());
  if (bytes.length !== source.byteSize || sha(bytes) !== source.sha256) throw new Error(`NY_2022_BLOCK_AUTHORITY_SOURCE_DRIFT:${source.id}`);
  const target = resolve(source.retainedPath); await mkdir(dirname(target), { recursive: true });
  try { await writeFile(target, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if (error.code !== "EEXIST" || !(await readFile(target)).equals(bytes)) throw new Error(`NY_2022_BLOCK_AUTHORITY_OUTPUT_CONFLICT:${source.id}`); }
}
process.stdout.write(`${JSON.stringify({ verifiedSources: 2, retainedSources: 2 })}\n`);
