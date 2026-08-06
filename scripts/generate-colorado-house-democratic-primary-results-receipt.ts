import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildColoradoPrimaryResultsReceipt } from "../src/ingestion/elections/colorado-house-democratic-primary-results-receipt";
import type { NewYorkSourceEntry } from "../src/ingestion/elections/new-york-house-democratic-primary-reported-results-receipt";

const ids = new Set([
  "co-2022-primary-certification-announcement",
  "co-2022-primary-signed-statewide-abstract",
  "co-2022-democratic-us-house-official-abstract",
  "co-2024-biennial-certified-abstract",
  "co-2024-democratic-us-house-normalized-transcription",
  "co-2026-primary-signed-statewide-abstract",
  "co-2026-democratic-us-house-normalized-transcription",
]);
const hash = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");

async function main(): Promise<void> {
  const lock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8")) as { entries: NewYorkSourceEntry[] };
  const entries = lock.entries.filter((entry) => ids.has(entry.id)); if (entries.length !== ids.size) throw new Error("CO_PRIMARY_LOCK_CLOSURE_INVALID");
  const inputs = await Promise.all(entries.map(async (entry) => ({ entry, bytes: await readFile(resolve(entry.retainedPath)) })));
  const value = buildColoradoPrimaryResultsReceipt(inputs), output = resolve("data/metadata/colorado-house-democratic-primary-results-2022-2026-v1.json"), bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("CO_PRIMARY_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, byteSize: bytes.length, sha256: hash(bytes), packageSha256: value.packageSha256, contestSetSha256: value.summary.contestSetSha256, summary: value.summary }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
