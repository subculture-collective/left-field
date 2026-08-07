import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { buildMainePrimaryIdentityCandidate } from "../src/ingestion/elections/maine-current-incumbent-primary-linkage-candidate";

const sha = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const load = async (path: string) => { const bytes = await readFile(path); return { bytes, value: JSON.parse(bytes.toString("utf8")), hash: sha(bytes) }; };

async function main() {
  const [roster, proposal, receipt, house, congress, sourceLock] = await Promise.all([
    load("data/metadata/dsa-target-incumbent-roster-20260804-v1.json"), load("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"), load("data/metadata/maine-house-democratic-primary-results-2022-2026-v1.json"), readFile("data/source/identity/house-member-data.xml"), readFile("data/source/identity/congress-legislators-current-20260804.json"), load("data/source-lock.json"),
  ]);
  const value = buildMainePrimaryIdentityCandidate({ roster: roster.value, rosterFileSha256: roster.hash, proposal: proposal.value, proposalFileSha256: proposal.hash, receipt: receipt.value, receiptFileSha256: receipt.hash, houseXml: house.toString("utf8"), houseFileSha256: sha(house), congressJson: congress.toString("utf8"), congressFileSha256: sha(congress), sourceLock: sourceLock.value });
  const output = "data/metadata/maine-current-incumbent-primary-linkage-candidate-v1.json";
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error(`MAINE_PRIMARY_IDENTITY_OUTPUT_CONFLICT:${String(error)}`); }
  console.log(JSON.stringify({ output, byteSize: bytes.length, sha256: sha(bytes), packageSha256: value.packageSha256, observationSetSha256: value.observationSetSha256, summary: value.summary }, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
