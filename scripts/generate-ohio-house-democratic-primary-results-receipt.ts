import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildOhioPrimaryResultsReceipt } from "../src/ingestion/elections/ohio-house-democratic-primary-results-receipt";
import type { NewYorkSourceEntry } from "../src/ingestion/elections/new-york-house-democratic-primary-reported-results-receipt";

const ids = new Set(["oh-election-results-files-index-20260806", "oh-2022-may-primary-portal-manifest-extract", "oh-2022-may-primary-democratic-summary", "oh-2024-march-primary-democratic-summary", "oh-2026-may-primary-democratic-summary"]);
const hash = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
async function main(): Promise<void> {
  const lock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8")) as { entries: NewYorkSourceEntry[] }, entries = lock.entries.filter((entry) => ids.has(entry.id)); if (entries.length !== ids.size) throw new Error("OH_PRIMARY_LOCK_CLOSURE_INVALID");
  const inputs = await Promise.all(entries.map(async (entry) => ({ entry, bytes: await readFile(resolve(entry.retainedPath)) }))), parentBytes = await readFile(resolve("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"));
  const value = buildOhioPrimaryResultsReceipt(inputs, { value: JSON.parse(parentBytes.toString("utf8")), bytes: parentBytes }), output = resolve("data/metadata/ohio-house-democratic-primary-results-2022-2026-v1.json"), bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("OH_PRIMARY_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, byteSize: bytes.length, sha256: hash(bytes), packageSha256: value.packageSha256, contestSetSha256: value.summary.contestSetSha256, summary: value.summary }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
