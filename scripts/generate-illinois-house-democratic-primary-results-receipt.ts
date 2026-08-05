import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildIllinoisHouseDemocraticPrimaryResultsReceipt, type IllinoisSourceLockEntry, validateIllinoisHouseDemocraticPrimaryResultsReceipt } from "../src/ingestion/elections/illinois-house-democratic-primary-results-receipt";

const sha = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
async function locked(entry: IllinoisSourceLockEntry): Promise<Buffer> { const bytes = await readFile(resolve(entry.retainedPath)); if (entry.retainedStatus !== "retained" || entry.kind !== "source" || bytes.byteLength !== entry.byteSize || sha(bytes) !== entry.sha256) throw new Error(`IL_PRIMARY_SOURCE_LOCK_MISMATCH:${entry.id}`); return bytes; }
async function writeExact(path: string, bytes: Buffer): Promise<void> { try { await writeFile(path, bytes, { mode: 0o644, flag: "wx" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; if (!(await readFile(path)).equals(bytes)) throw new Error("IL_PRIMARY_RECEIPT_OUTPUT_CONFLICT"); } }

async function main(): Promise<void> {
  const lock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8")) as { entries: IllinoisSourceLockEntry[] };
  const listings = lock.entries.filter(({ id }) => /^il-(2022|2024)-house-primary-listing$/.test(id));
  const resultEntries = lock.entries.filter(({ id }) => /^il-(2022|2024)-house-primary-district-(0[1-9]|1[0-7])$/.test(id));
  await Promise.all(listings.map(locked));
  const results = await Promise.all(resultEntries.map(async (entry) => ({ entry, bytes: await locked(entry) })));
  const receipt = validateIllinoisHouseDemocraticPrimaryResultsReceipt(buildIllinoisHouseDemocraticPrimaryResultsReceipt({ listings, results }));
  const output = resolve("data/metadata/illinois-house-democratic-primary-results-receipt-2022-2024-v1.json");
  await writeExact(output, Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`));
  process.stdout.write(`${JSON.stringify({ output, ...receipt.summary, certificationStatus: receipt.certificationStatus, packageSha256: receipt.packageSha256 }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "IL_PRIMARY_RECEIPT_GENERATION_FAILED"}\n`); process.exitCode = 1; });
