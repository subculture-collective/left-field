import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildPennsylvaniaPrimaryResultsReceipt } from "../src/ingestion/elections/pennsylvania-house-democratic-primary-results-receipt";
type Entry = { id: string; retainedPath: string | null; retainedStatus: string; byteSize: number; sha256: string; kind: string; url: string; parentIds: string[] };
const sha = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
async function main(): Promise<void> {
  const lock = JSON.parse(await readFile("data/source-lock.json", "utf8")) as { entries: Entry[] }, ids = ["pa-2022-primary-returns-readme", "pa-2022-primary-precinct-returns", "pa-2024-primary-returns-readme", "pa-2024-primary-precinct-returns"], byId = new Map(lock.entries.map((entry) => [entry.id, entry]));
  const inputs = await Promise.all(ids.map(async (id) => { const entry = byId.get(id); if (!entry || !entry.retainedPath || entry.retainedStatus !== "retained" || entry.kind !== "source") throw new Error(`PA_PRIMARY_RECEIPT_LOCK_MISSING:${id}`); const bytes = await readFile(entry.retainedPath); if (bytes.byteLength !== entry.byteSize || sha(bytes) !== entry.sha256) throw new Error(`PA_PRIMARY_RECEIPT_LOCK_MISMATCH:${id}`); return { entry: { ...entry, retainedPath: entry.retainedPath, retainedStatus: "retained" as const, kind: "source" as const }, bytes }; }));
  const value = buildPennsylvaniaPrimaryResultsReceipt(inputs), output = resolve("data/metadata/pennsylvania-house-democratic-primary-results-2022-2024-v1.json"), bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("PA_PRIMARY_RECEIPT_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, byteSize: bytes.byteLength, sha256: sha(bytes), packageSha256: value.packageSha256, summary: value.summary }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "PA_PRIMARY_RECEIPT_GENERATION_FAILED"}\n`); process.exitCode = 1; });
