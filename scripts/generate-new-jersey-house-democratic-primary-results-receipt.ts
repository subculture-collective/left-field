import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildNewJerseyPrimaryResultsReceipt } from "../src/ingestion/elections/new-jersey-house-democratic-primary-results-receipt";

type Entry = { id: string; retainedPath: string | null; retainedStatus: string; byteSize: number; sha256: string; kind: string; url: string; parentIds: string[] };
const sha = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
async function main(): Promise<void> {
  const lock = JSON.parse(await readFile("data/source-lock.json", "utf8")) as { entries: Entry[] }, byId = new Map(lock.entries.map((entry) => [entry.id, entry]));
  const inputs = await Promise.all(([2022, 2024, 2026] as const).map(async (year) => {
    const pdfId = `nj-${year}-official-primary-results-us-house-pdf`, textId = `nj-${year}-official-primary-results-us-house-text`, pdfEntry = byId.get(pdfId), textEntry = byId.get(textId);
    if (!pdfEntry?.retainedPath || pdfEntry.retainedStatus !== "retained" || pdfEntry.kind !== "source" || !textEntry?.retainedPath || textEntry.retainedStatus !== "retained" || textEntry.kind !== "derived_extract") throw new Error(`NJ_PRIMARY_RECEIPT_LOCK_MISSING:${year}`);
    const [pdfBytes, textBytes] = await Promise.all([readFile(pdfEntry.retainedPath), readFile(textEntry.retainedPath)]); if (pdfBytes.byteLength !== pdfEntry.byteSize || sha(pdfBytes) !== pdfEntry.sha256 || textBytes.byteLength !== textEntry.byteSize || sha(textBytes) !== textEntry.sha256) throw new Error(`NJ_PRIMARY_RECEIPT_LOCK_MISMATCH:${year}`);
    return { pdfEntry: { ...pdfEntry, retainedPath: pdfEntry.retainedPath, retainedStatus: "retained" as const, kind: "source" as const }, pdfBytes, textEntry: { ...textEntry, retainedPath: textEntry.retainedPath, retainedStatus: "retained" as const, kind: "derived_extract" as const }, textBytes };
  }));
  const value = buildNewJerseyPrimaryResultsReceipt(inputs), output = resolve("data/metadata/new-jersey-house-democratic-primary-results-2022-2026-v1.json"), bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("NJ_PRIMARY_RECEIPT_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, byteSize: bytes.byteLength, sha256: sha(bytes), packageSha256: value.packageSha256, summary: value.summary }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "NJ_PRIMARY_RECEIPT_GENERATION_FAILED"}\n`); process.exitCode = 1; });
