import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { buildMarylandPrimaryIdentityCandidate } from "../src/ingestion/elections/maryland-current-incumbent-primary-linkage-candidate";

const load = async (path: string) => {
  const bytes = await readFile(path);
  return { bytes, value: JSON.parse(bytes.toString("utf8")), sha256: createHash("sha256").update(bytes).digest("hex") };
};
const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

async function main(): Promise<void> {
  const roster = await load("data/metadata/dsa-target-incumbent-roster-20260804-v1.json");
  const proposal = await load("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json");
  const receipt = await load("data/metadata/maryland-house-democratic-primary-results-2022-2024-v1.json");
  const house = await readFile("data/source/identity/house-member-data.xml");
  const congress = await readFile("data/source/identity/congress-legislators-current-20260804.json");
  const sourceLock = await load("data/source-lock.json");
  const value = buildMarylandPrimaryIdentityCandidate({
    roster: roster.value,
    rosterFileSha256: roster.sha256,
    proposal: proposal.value,
    proposalFileSha256: proposal.sha256,
    receipt: receipt.value,
    receiptFileSha256: receipt.sha256,
    houseXml: house.toString("utf8"),
    houseFileSha256: sha256(house),
    congressJson: congress.toString("utf8"),
    congressFileSha256: sha256(congress),
    sourceLock: sourceLock.value,
  });
  const output = "data/metadata/maryland-current-incumbent-primary-linkage-candidate-v1.json";
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) {
      throw new Error("MARYLAND_PRIMARY_IDENTITY_OUTPUT_CONFLICT");
    }
  }
  console.log(JSON.stringify({
    output,
    byteSize: bytes.length,
    sha256: sha256(bytes),
    packageSha256: value.packageSha256,
    observationSetSha256: value.observationSetSha256,
    parentProjectionSha256: value.methodology.parentProjectionSha256,
    summary: value.summary,
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
