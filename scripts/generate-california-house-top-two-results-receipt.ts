import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildCaliforniaHouseTopTwoResultsReceipt } from "../src/ingestion/elections/california-house-top-two-results-receipt";

type Entry = { id: string; url: string; retainedPath?: string; retainedStatus: string; byteSize: number; sha256: string; kind: string; parentIds: string[] };
const ids = new Set([
  "ca-2022-house-primary-sov-xlsx", "ca-2022-house-primary-sov-pdf", "ca-2022-primary-secretary-certificate",
  "ca-2024-house-primary-sov-xlsx", "ca-2024-house-primary-sov-pdf", "ca-2024-primary-secretary-certificate", "ca-2024-cd16-primary-recertification",
  "ca-2026-house-primary-sov-xlsx", "ca-2026-house-primary-sov-pdf", "ca-2026-primary-secretary-certificate",
  "ca-top-two-primary-rules-snapshot-20260805", "ca-house-top-two-candidate-totals-2022-2026-v1",
]);
const hash = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

async function main(): Promise<void> {
  const lock = JSON.parse(await readFile("data/source-lock.json", "utf8")) as { entries: Entry[] };
  const entries = lock.entries.filter((entry) => ids.has(entry.id));
  if (entries.length !== ids.size) throw new Error("CA_TOP_TWO_LOCK_CLOSURE_INVALID");
  const inputs = await Promise.all(entries.map(async (entry) => {
    if (!entry.retainedPath || entry.retainedStatus !== "retained") throw new Error("CA_TOP_TWO_LOCK_INVALID");
    const bytes = await readFile(entry.retainedPath);
    if (bytes.length !== entry.byteSize || hash(bytes) !== entry.sha256) throw new Error("CA_TOP_TWO_BYTES_INVALID");
    return { entry: { ...entry, retainedPath: entry.retainedPath, retainedStatus: "retained" as const }, bytes };
  }));
  const parentBytes = await readFile("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json");
  const value = buildCaliforniaHouseTopTwoResultsReceipt(inputs, { value: JSON.parse(parentBytes.toString("utf8")), fileSha256: hash(parentBytes) });
  const output = resolve("data/metadata/california-house-top-two-results-2022-2026-v1.json");
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("CA_TOP_TWO_OUTPUT_CONFLICT"); }
  console.log(JSON.stringify({ output, byteSize: bytes.length, sha256: hash(bytes), packageSha256: value.packageSha256, summary: value.summary }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
