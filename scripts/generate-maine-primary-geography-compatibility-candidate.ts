import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { buildMainePrimaryGeographyCompatibilityCandidate } from "../src/ingestion/elections/maine-primary-geography-compatibility-candidate";

const sha = (value: Buffer): string => createHash("sha256").update(value).digest("hex");

async function main(): Promise<void> {
  const [proposalJson, resultsReceiptJson, identityCandidateJson, authorityReceiptJson, sourceLockBytes] = await Promise.all([
    readFile("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "utf8"),
    readFile("data/metadata/maine-house-democratic-primary-results-2022-2026-v1.json", "utf8"),
    readFile("data/metadata/maine-current-incumbent-primary-linkage-candidate-v1.json", "utf8"),
    readFile("data/metadata/maine-primary-geography-authority-source-receipt-v1.json", "utf8"),
    readFile("data/source-lock.json"),
  ]);
  const value = buildMainePrimaryGeographyCompatibilityCandidate({ proposalJson, resultsReceiptJson, identityCandidateJson, authorityReceiptJson, sourceLock: JSON.parse(sourceLockBytes.toString("utf8")) });
  const output = "data/metadata/maine-primary-geography-compatibility-candidate-v1.json";
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try {
    await writeFile(output, bytes, { flag: "wx", mode: 0o644 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("MAINE_PRIMARY_GEOGRAPHY_COMPATIBILITY_CANDIDATE_OUTPUT_CONFLICT");
  }
  process.stdout.write(`${JSON.stringify({ output, byteSize: bytes.byteLength, sha256: sha(bytes), packageSha256: value.packageSha256, rowSetSha256: value.rowSetSha256, summary: value.summary }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
