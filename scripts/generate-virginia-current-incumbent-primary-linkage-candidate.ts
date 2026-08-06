import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { buildVirginiaCurrentIncumbentPrimaryLinkageCandidate } from "../src/ingestion/elections/virginia-current-incumbent-primary-linkage-candidate";

const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

async function main(): Promise<void> {
  const [rosterBytes, proposalBytes, receiptBytes, houseBytes, congressBytes, sourceLockBytes] = await Promise.all([
    readFile("data/metadata/dsa-target-incumbent-roster-20260804-v1.json"),
    readFile("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"),
    readFile("data/metadata/virginia-house-democratic-primary-results-2022-2026-v1.json"),
    readFile("data/source/identity/house-member-data.xml"),
    readFile("data/source/identity/congress-legislators-current-20260804.json"),
    readFile("data/source-lock.json"),
  ]);
  const value = buildVirginiaCurrentIncumbentPrimaryLinkageCandidate({
    rosterBytes, proposalBytes, receiptBytes, houseBytes, congressBytes, sourceLockBytes,
  });
  const output = "data/metadata/virginia-current-incumbent-primary-linkage-candidate-v1.json";
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try {
    await writeFile(output, bytes, { flag: "wx", mode: 0o644 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) {
      throw new Error("VIRGINIA_PRIMARY_IDENTITY_OUTPUT_CONFLICT");
    }
  }
  console.log(JSON.stringify({
    output,
    byteSize: bytes.length,
    sha256: sha256(bytes),
    packageSha256: value.packageSha256,
    observationSetSha256: value.observationSetSha256,
    summary: value.summary,
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
