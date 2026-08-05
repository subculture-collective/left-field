import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildNjPaPrimaryGeographyCompatibilityCandidate } from "../src/ingestion/elections/nj-pa-primary-geography-compatibility-candidate";

const sha = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
async function load(path: string): Promise<{ bytes: Buffer; sha256: string; json: unknown }> { const bytes = await readFile(resolve(path)); return { bytes, sha256: sha(bytes), json: JSON.parse(bytes.toString("utf8")) }; }
function dbf(path: string): Buffer { return execFileSync("unzip", ["-p", resolve(path), "*.dbf"], { maxBuffer: 4 * 1024 * 1024 }); }
async function main(): Promise<void> {
  const proposal = await load("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"), linkage = await load("data/metadata/current-incumbent-primary-candidate-linkage-candidate-v1.json"), authority = await readFile(resolve("data/source/elections/primary-results/geography/census-119-congressional-district-bef.html")), nj118 = await readFile(resolve("data/source/tiger2022/tl_2022_34_cd118.zip")), pa118 = await readFile(resolve("data/source/tiger2022/tl_2022_42_cd118.zip")), nj119 = await readFile(resolve("data/source/tiger2025/tl_2025_34_cd119.zip")), pa119 = await readFile(resolve("data/source/tiger2025/tl_2025_42_cd119.zip")), sourceLock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8"));
  const value = buildNjPaPrimaryGeographyCompatibilityCandidate({ proposal: proposal.json, proposalFileSha256: proposal.sha256, linkage: linkage.json, linkageFileSha256: linkage.sha256, authorityHtml: authority.toString("utf8"), authorityFileSha256: sha(authority), nj118Dbf: dbf("data/source/tiger2022/tl_2022_34_cd118.zip"), nj118FileSha256: sha(nj118), pa118Dbf: dbf("data/source/tiger2022/tl_2022_42_cd118.zip"), pa118FileSha256: sha(pa118), nj119Dbf: dbf("data/source/tiger2025/tl_2025_34_cd119.zip"), nj119FileSha256: sha(nj119), pa119Dbf: dbf("data/source/tiger2025/tl_2025_42_cd119.zip"), pa119FileSha256: sha(pa119), sourceLock });
  const output = resolve("data/metadata/nj-pa-primary-geography-compatibility-candidate-v1.json"), bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`); try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("PRIMARY_GEOGRAPHY_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, summary: value.summary, rowSetSha256: value.rowSetSha256, packageSha256: value.packageSha256 }, null, 2)}\n`);
}
void main().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
