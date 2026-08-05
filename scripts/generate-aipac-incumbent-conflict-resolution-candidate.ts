import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildAipacIncumbentConflictResolutionCandidate } from "../src/ingestion/fec/aipac-incumbent-conflict-resolution-candidate";

const digest = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const root = resolve("data/metadata");

async function load(file: string): Promise<{ value: unknown; sha256: string }> {
  const bytes = await readFile(resolve(root, file));
  return { value: JSON.parse(bytes.toString("utf8")), sha256: digest(bytes) };
}

async function main(): Promise<void> {
  const proposal = await load("aipac-candidate-seat-mappings-proposal-v1.json");
  const authorityReceipt = await load("aipac-incumbent-fec-authority-receipt-v1.json");
  const sourceLock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8")) as { entries: Array<{ id: string; retainedStatus: string; sha256: string; byteSize: number; url: string }> };
  const candidate = buildAipacIncumbentConflictResolutionCandidate({ proposal: proposal.value, proposalFileSha256: proposal.sha256, authorityReceipt: authorityReceipt.value, authorityReceiptFileSha256: authorityReceipt.sha256, sourceLockEntries: sourceLock.entries });
  const output = resolve(root, "aipac-incumbent-conflict-resolution-candidate-v1.json");
  const bytes = Buffer.from(`${JSON.stringify(candidate, null, 2)}\n`, "utf8");
  try {
    const existing = await readFile(output);
    if (!existing.equals(bytes)) throw new Error("AIPAC_INCUMBENT_RESOLUTION_OUTPUT_CONFLICT");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await writeFile(output, bytes, { mode: 0o644, flag: "wx" });
  }
  process.stdout.write(`${JSON.stringify({ output, summary: candidate.summary, packageSha256: candidate.packageSha256 }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "AIPAC_INCUMBENT_RESOLUTION_GENERATION_FAILED"}\n`);
  process.exitCode = 1;
});
