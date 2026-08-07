import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildGeorgiaPrimaryResultsReceipt, validateGeorgiaPrimaryResultsReceipt } from "../src/ingestion/elections/georgia-house-democratic-primary-results-receipt";
import type { NewYorkSourceEntry } from "../src/ingestion/elections/new-york-house-democratic-primary-reported-results-receipt";

const ids = new Set([
  "ga-2022-general-primary-election-metadata",
  "ga-2022-general-primary-total-votes-workbook",
  "ga-2024-general-primary-election-metadata",
  "ga-2024-general-primary-total-votes-workbook",
  "ga-2026-general-primary-election-metadata",
  "ga-2026-general-primary-total-votes-workbook",
]);
const hash = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");

async function main(): Promise<void> {
  const lock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8")) as { entries: NewYorkSourceEntry[] };
  const entries = lock.entries.filter((entry) => ids.has(entry.id)); if (entries.length !== ids.size) throw new Error("GA_PRIMARY_LOCK_CLOSURE_INVALID");
  const inputs = await Promise.all(entries.map(async (entry) => ({ entry, bytes: await readFile(resolve(entry.retainedPath)) })));
  const proposalBytes = await readFile(resolve("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"));
  const value = validateGeorgiaPrimaryResultsReceipt(buildGeorgiaPrimaryResultsReceipt(inputs, { value: JSON.parse(proposalBytes.toString("utf8")) as unknown, bytes: proposalBytes }, lock));
  const output = resolve("data/metadata/georgia-house-democratic-primary-results-2022-2026-v1.json"), outputBytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, outputBytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(outputBytes)) throw new Error("GA_PRIMARY_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, byteSize: outputBytes.length, sha256: hash(outputBytes), packageSha256: value.packageSha256, contestSetSha256: value.summary.contestSetSha256, targetObservationSetSha256: value.summary.targetObservationSetSha256, summary: value.summary }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
