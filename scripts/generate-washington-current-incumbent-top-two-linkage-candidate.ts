import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { buildWashingtonTopTwoIdentityCandidate } from "../src/ingestion/elections/washington-current-incumbent-top-two-linkage-candidate";

const sha256 = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
const text = async (path: string): Promise<string> => (await readFile(path)).toString("utf8");

async function main(): Promise<void> {
  const value = buildWashingtonTopTwoIdentityCandidate({
    rosterJson: await text("data/metadata/dsa-target-incumbent-roster-20260804-v1.json"),
    proposalJson: await text("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"),
    houseXml: await text("data/source/identity/house-member-data.xml"),
    congressJson: await text("data/source/identity/congress-legislators-current-20260804.json"),
    receiptJson: await text("data/metadata/washington-house-top-two-results-receipt-20220802-20240806-v1.json"),
    sourceLockJson: await text("data/source-lock.json"),
  });
  const output = "data/metadata/washington-current-incumbent-top-two-linkage-candidate-v1.json";
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("WASHINGTON_TOP_TWO_IDENTITY_OUTPUT_CONFLICT");
  }
  console.log(JSON.stringify({ output, byteSize: bytes.length, sha256: sha256(bytes), packageSha256: value.packageSha256, observationSetSha256: value.observationSetSha256, summary: value.summary }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
