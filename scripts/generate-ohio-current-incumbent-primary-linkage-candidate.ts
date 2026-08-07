import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { buildOhioPrimaryIdentityCandidate, validateOhioPrimaryIdentityCandidate } from "../src/ingestion/elections/ohio-current-incumbent-primary-linkage-candidate";
const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
async function main(): Promise<void> {
  const [rosterBytes, proposalBytes, houseBytes, congressBytes, receiptBytes, lockBytes] = await Promise.all([
    readFile("data/metadata/dsa-target-incumbent-roster-20260804-v1.json"), readFile("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"), readFile("data/source/identity/house-member-data.xml"), readFile("data/source/identity/congress-legislators-current-20260804.json"), readFile("data/metadata/ohio-house-democratic-primary-results-2022-2026-v4.json"), readFile("data/source-lock.json"),
  ]);
  const value = validateOhioPrimaryIdentityCandidate(buildOhioPrimaryIdentityCandidate({ roster: JSON.parse(rosterBytes.toString("utf8")), rosterFileSha256: sha256(rosterBytes), proposal: JSON.parse(proposalBytes.toString("utf8")), proposalFileSha256: sha256(proposalBytes), houseXml: houseBytes.toString("utf8"), houseFileSha256: sha256(houseBytes), congressJson: congressBytes.toString("utf8"), congressFileSha256: sha256(congressBytes), receipt: JSON.parse(receiptBytes.toString("utf8")), receiptFileSha256: sha256(receiptBytes), sourceLock: JSON.parse(lockBytes.toString("utf8")) }));
  const output = "data/metadata/ohio-current-incumbent-primary-linkage-candidate-v1.json", bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("OHIO_PRIMARY_IDENTITY_OUTPUT_CONFLICT"); }
  console.log(JSON.stringify({ output, byteSize: bytes.length, sha256: sha256(bytes), packageSha256: value.packageSha256, observationSetSha256: value.observationSetSha256, summary: value.summary }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
