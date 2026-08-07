import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { buildMinnesotaPrimaryIdentityCandidate } from "../src/ingestion/elections/minnesota-current-incumbent-primary-linkage-candidate";

const sha256 = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
const load = async (path: string) => {
  const bytes = await readFile(path);
  return { bytes, value: JSON.parse(bytes.toString("utf8")), sha256: sha256(bytes) };
};

async function main(): Promise<void> {
  const [roster, proposal, receipt, house, congress, sourceLock] = await Promise.all([
    load("data/metadata/dsa-target-incumbent-roster-20260804-v1.json"),
    load("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"),
    load("data/metadata/minnesota-house-democratic-primary-results-2022-2026-v1.json"),
    readFile("data/source/identity/house-member-data.xml"),
    readFile("data/source/identity/congress-legislators-current-20260804.json"),
    load("data/source-lock.json"),
  ]);
  const value = buildMinnesotaPrimaryIdentityCandidate({
    roster: roster.value, rosterFileSha256: roster.sha256,
    proposal: proposal.value, proposalFileSha256: proposal.sha256,
    receipt: receipt.value, receiptFileSha256: receipt.sha256,
    houseXml: house.toString("utf8"), houseFileSha256: sha256(house),
    congressJson: congress.toString("utf8"), congressFileSha256: sha256(congress),
    sourceLock: sourceLock.value,
  });
  const output = "data/metadata/minnesota-current-incumbent-primary-linkage-candidate-v1.json";
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try {
    await writeFile(output, bytes, { flag: "wx", mode: 0o644 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) {
      throw new Error(`MINNESOTA_PRIMARY_IDENTITY_OUTPUT_CONFLICT:${String(error)}`);
    }
  }
  console.log(JSON.stringify({ output, byteSize: bytes.length, sha256: sha256(bytes), packageSha256: value.packageSha256, observationSetSha256: value.observationSetSha256, summary: value.summary }, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
