import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildNewMexicoPrimaryResultsReceipt, validateNewMexicoPrimaryResultsReceipt, type NewMexicoSourceEntry } from "../src/ingestion/elections/new-mexico-house-democratic-primary-results-receipt";

const ids = new Set(["nm-2022-primary-federal-results-csv", "nm-2024-primary-federal-results-csv", "nm-2026-primary-federal-results-csv", "nm-2022-election-results-archive", "nm-2024-primary-certification-announcement", "nm-2026-primary-certification-announcement"]);
const hash = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");

async function main(): Promise<void> {
  const lock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8")) as { entries: NewMexicoSourceEntry[] }, entries = lock.entries.filter((entry) => ids.has(entry.id)); if (entries.length !== ids.size) throw new Error("NM_PRIMARY_LOCK_CLOSURE_INVALID");
  const inputs = await Promise.all(entries.map(async (entry) => ({ entry, bytes: await readFile(resolve(entry.retainedPath)) }))), proposalBytes = await readFile(resolve("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"));
  const value = validateNewMexicoPrimaryResultsReceipt(buildNewMexicoPrimaryResultsReceipt(inputs, { value: JSON.parse(proposalBytes.toString("utf8")) as unknown, bytes: proposalBytes }, lock)), output = resolve("data/metadata/new-mexico-house-democratic-primary-results-2022-2026-v1.json"), outputBytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, outputBytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(outputBytes)) throw new Error("NM_PRIMARY_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, byteSize: outputBytes.length, sha256: hash(outputBytes), packageSha256: value.packageSha256, contestSetSha256: value.summary.contestSetSha256, targetObservationSetSha256: value.summary.targetObservationSetSha256, summary: value.summary }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
