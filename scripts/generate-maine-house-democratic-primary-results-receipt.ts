import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildMainePrimaryResultsReceipt, validateMainePrimaryResultsReceipt, type MaineSourceEntry } from "../src/ingestion/elections/maine-house-democratic-primary-results-receipt";

const ids = new Set([
  "maine-2022-election-results-index",
  "maine-2022-house-democratic-primary-cd01-results",
  "maine-2022-house-democratic-primary-cd02-results",
  "maine-2024-election-results-index",
  "maine-2024-house-democratic-primary-cd01-results",
  "maine-2024-house-democratic-primary-cd02-results",
  "maine-2026-election-results-index",
  "maine-2026-house-democratic-primary-cd01-results",
  "maine-2026-house-democratic-primary-cd02-first-choice-results",
  "maine-2026-house-democratic-primary-cd02-rcv-summary",
  "maine-2026-house-democratic-primary-cd02-rcv-summary-layout-text",
]);
const hash = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");

async function main(): Promise<void> {
  const lock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8")) as { entries: MaineSourceEntry[] };
  const entries = lock.entries.filter((entry) => ids.has(entry.id)); if (entries.length !== ids.size) throw new Error("MAINE_PRIMARY_LOCK_CLOSURE_INVALID");
  const inputs = await Promise.all(entries.map(async (entry) => ({ entry, bytes: await readFile(resolve(entry.retainedPath)) })));
  const proposalBytes = await readFile(resolve("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"));
  const value = validateMainePrimaryResultsReceipt(buildMainePrimaryResultsReceipt(inputs, { value: JSON.parse(proposalBytes.toString("utf8")) as unknown, bytes: proposalBytes }, lock));
  const output = resolve("data/metadata/maine-house-democratic-primary-results-2022-2026-v1.json"), outputBytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, outputBytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(outputBytes)) throw new Error("MAINE_PRIMARY_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, byteSize: outputBytes.length, sha256: hash(outputBytes), packageSha256: value.packageSha256, contestSetSha256: value.summary.contestSetSha256, targetObservationSetSha256: value.summary.targetObservationSetSha256, summary: value.summary }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
