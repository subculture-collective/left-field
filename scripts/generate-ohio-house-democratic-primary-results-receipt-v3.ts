import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { buildOhioPrimaryResultsReceiptV3 } from "../src/ingestion/elections/ohio-house-democratic-primary-results-receipt-v3";
import type { NewYorkSourceEntry } from "../src/ingestion/elections/new-york-house-democratic-primary-reported-results-receipt";

const ids = new Set([
  "oh-2022-may-primary-warren-official-results",
  "oh-2022-may-primary-erie-official-canvass",
  "oh-2022-may-primary-ottawa-amended-official-summary",
  "oh-2022-may-primary-sandusky-official-canvass",
  "oh-2022-may-primary-williams-official-cumulative",
]);
const hash = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");

async function main(): Promise<void> {
  const lock = JSON.parse(await readFile("data/source-lock.json", "utf8")) as { entries: NewYorkSourceEntry[] };
  const entries = lock.entries.filter((entry) => ids.has(entry.id));
  if (entries.length !== ids.size) throw new Error("OH_PRIMARY_V3_LOCK_CLOSURE_INVALID");
  const inputs = await Promise.all(entries.map(async (entry) => {
    const bytes = await readFile(entry.retainedPath);
    const text = entry.retainedPath.endsWith(".pdf")
      ? execFileSync("pdftotext", ["-layout", entry.retainedPath, "-"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 })
      : bytes.toString("utf8");
    return { entry, bytes, text };
  }));
  const parentBytes = await readFile("data/metadata/ohio-house-democratic-primary-results-2022-2026-v2.json");
  const value = buildOhioPrimaryResultsReceiptV3(inputs, { value: JSON.parse(parentBytes.toString("utf8")), bytes: parentBytes });
  const output = "data/metadata/ohio-house-democratic-primary-results-2022-2026-v3.json", bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("OH_PRIMARY_V3_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, byteSize: bytes.length, sha256: hash(bytes), packageSha256: value.packageSha256, contestSetSha256: value.summary.contestSetSha256, summary: value.summary }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
