import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parseWashingtonHouseTopTwoResultsReceipt, validateWashingtonHouseTopTwoResultsReceipt } from "../src/ingestion/elections/washington-house-top-two-results-receipt";

type Entry = { id: string; retainedPath: string | null; retainedStatus: string; byteSize: number; sha256: string; kind: string };
const sha = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
async function locked(entry: Entry): Promise<Buffer> { if (entry.retainedStatus !== "retained" || !entry.retainedPath || entry.kind !== "source") throw new Error(`WA_TOP_TWO_SOURCE_NOT_RETAINED:${entry.id}`); const bytes = await readFile(resolve(entry.retainedPath)); if (bytes.byteLength !== entry.byteSize || sha(bytes) !== entry.sha256) throw new Error(`WA_TOP_TWO_SOURCE_LOCK_MISMATCH:${entry.id}`); return bytes; }
async function writeExact(path: string, bytes: Buffer): Promise<void> { try { await writeFile(path, bytes, { mode: 0o644, flag: "wx" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; if (!(await readFile(path)).equals(bytes)) throw new Error("WA_TOP_TWO_RECEIPT_OUTPUT_CONFLICT"); } }
async function main(): Promise<void> {
  const lock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8")) as { entries: Entry[] }; const byId = new Map(lock.entries.map((entry) => [entry.id, entry]));
  const ids = ["wa-2022-house-primary-results", "wa-2024-house-primary-results", "wa-2022-primary-certification", "wa-2024-primary-certification"] as const; const entries = ids.map((id) => byId.get(id)); if (entries.some((entry) => !entry)) throw new Error("WA_TOP_TWO_SOURCE_LOCK_ENTRY_MISSING");
  const [source2022, source2024, certification2022, certification2024] = await Promise.all(entries.map((entry) => locked(entry!)));
  const receipt = validateWashingtonHouseTopTwoResultsReceipt(parseWashingtonHouseTopTwoResultsReceipt({ 2022: source2022, 2024: source2024, certification2022, certification2024 }));
  const output = resolve("data/metadata/washington-house-top-two-results-receipt-20220802-20240806-v1.json"); await writeExact(output, Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`));
  process.stdout.write(`${JSON.stringify({ output, ...receipt.summary, certificationStatus: receipt.certificationStatus, formulaApplicability: receipt.formulaApplicability, packageSha256: receipt.packageSha256 }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "WA_TOP_TWO_RECEIPT_GENERATION_FAILED"}\n`); process.exitCode = 1; });
