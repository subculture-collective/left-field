import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildCaliforniaPrimaryGeographyCompatibilityCandidate } from "../src/ingestion/elections/california-primary-geography-compatibility-candidate";

const sha = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
async function load(path: string): Promise<{ bytes: Buffer; sha256: string; json: unknown }> { const bytes = await readFile(resolve(path)); return { bytes, sha256: sha(bytes), json: JSON.parse(bytes.toString("utf8")) }; }
function dbf(path: string): Buffer { return execFileSync("unzip", ["-p", resolve(path), "*.dbf"], { maxBuffer: 4 * 1024 * 1024 }); }
async function main(): Promise<void> {
  const proposal = await load("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"), receipt = await load("data/metadata/california-house-top-two-results-2022-2026-v1.json"), authority = await readFile(resolve("data/source/elections/primary-results/geography/census-119-congressional-district-bef.html")), ca118 = await readFile(resolve("data/source/tiger2022/tl_2022_06_cd118.zip")), ca119 = await readFile(resolve("data/source/tiger2025/tl_2025_06_cd119.zip")), sourceLock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8"));
  const value = buildCaliforniaPrimaryGeographyCompatibilityCandidate({ proposal: proposal.json, proposalFileSha256: proposal.sha256, receipt: receipt.json, receiptFileSha256: receipt.sha256, authorityHtml: authority.toString("utf8"), authorityFileSha256: sha(authority), ca118Dbf: dbf("data/source/tiger2022/tl_2022_06_cd118.zip"), ca118FileSha256: sha(ca118), ca119Dbf: dbf("data/source/tiger2025/tl_2025_06_cd119.zip"), ca119FileSha256: sha(ca119), sourceLock });
  const output = resolve("data/metadata/california-primary-geography-compatibility-candidate-v1.json"), bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("CA_PRIMARY_GEOGRAPHY_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, summary: value.summary, rowSetSha256: value.rowSetSha256, packageSha256: value.packageSha256 }, null, 2)}\n`);
}
void main().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
