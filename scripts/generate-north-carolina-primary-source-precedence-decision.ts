import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { buildNcPrimarySourcePrecedenceDecision } from "../src/ingestion/elections/north-carolina-primary-source-precedence-decision";

const sha = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
async function main(): Promise<void> {
  const receiptBytes = await readFile("data/metadata/north-carolina-house-democratic-primary-results-2022-2026-v1.json");
  const sourceLock = JSON.parse(await readFile("data/source-lock.json", "utf8"));
  const value = buildNcPrimarySourcePrecedenceDecision({ receipt: JSON.parse(receiptBytes.toString("utf8")), receiptFileSha256: sha(receiptBytes), sourceLockEntries: sourceLock.entries });
  const output = "data/metadata/north-carolina-primary-source-precedence-decision-v1.json";
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw error; }
  console.log(JSON.stringify({ output, byteSize: bytes.length, sha256: sha(bytes), packageSha256: value.packageSha256, decisionId: value.decisionId, status: value.resolution.status }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
