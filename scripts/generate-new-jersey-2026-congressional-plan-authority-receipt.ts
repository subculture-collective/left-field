import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { buildNewJersey2026CongressionalPlanAuthorityReceipt } from "../src/ingestion/elections/new-jersey-2026-congressional-plan-authority";

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
async function main() {
  const base = "data/source/elections/primary-results/geography/new-jersey/2026";
  const [publicationsBytes, mapBytes, mapTextBytes, statuteBytes, componentsBytes, componentsTextBytes, currentBlocksBytes, sourceLockBytes] = await Promise.all([
    readFile(`${base}/division-of-elections-publications.html`),
    readFile(`${base}/2022-2031-congressional-map.pdf`),
    readFile(`${base}/2022-2031-congressional-map.txt`),
    readFile(`${base}/njsa-19-46-12.html`),
    readFile(`${base}/njcd-2022-plan-components-report.pdf`),
    readFile(`${base}/njcd-2022-plan-components-report.txt`),
    readFile("data/source/elections/primary-results/geography/new-jersey/current/34_NJ_CD119.txt"),
    readFile("data/source-lock.json"),
  ]);
  const value = buildNewJersey2026CongressionalPlanAuthorityReceipt({ publicationsBytes, mapBytes, mapTextBytes, statuteBytes, componentsBytes, componentsTextBytes, currentBlocksBytes, sourceLock: JSON.parse(sourceLockBytes.toString("utf8")) });
  const output = "data/metadata/new-jersey-2026-congressional-plan-authority-receipt-v1.json";
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try {
    await writeFile(output, bytes, { flag: "wx", mode: 0o644 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("NEW_JERSEY_2026_PLAN_AUTHORITY_OUTPUT_CONFLICT");
  }
  process.stdout.write(`${JSON.stringify({ output, byteSize: bytes.length, sha256: sha(bytes), packageSha256: value.packageSha256, blockInventory: value.blockInventory, planComponentsAssessment: value.planComponentsAssessment }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
