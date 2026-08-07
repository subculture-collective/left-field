import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { unzipSync } from "fflate";

import { buildNewMexicoPrimaryGeographyCandidate, validateNewMexicoPrimaryGeographyCandidate } from "../src/ingestion/elections/new-mexico-primary-geography-compatibility-candidate";

const sha256 = (value: Buffer): string => createHash("sha256").update(value).digest("hex");

async function main() {
  const [proposal, receipt, identity, authority, nm118, nm119, sourceLock] = await Promise.all([
    readFile("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"),
    readFile("data/metadata/new-mexico-house-democratic-primary-results-2022-2026-v1.json"),
    readFile("data/metadata/new-mexico-current-incumbent-primary-linkage-candidate-v1.json"),
    readFile("data/source/elections/primary-results/geography/census-119-congressional-district-bef.html"),
    readFile("data/source/tiger2022/tl_2022_35_cd118.zip"),
    readFile("data/source/tiger2025/tl_2025_35_cd119.zip"),
    readFile("data/source-lock.json"),
  ]);
  const nm118Dbf = unzipSync(nm118)["tl_2022_35_cd118.dbf"];
  const nm119Dbf = unzipSync(nm119)["tl_2025_35_cd119.dbf"];
  if (!nm118Dbf || !nm119Dbf) throw new Error("NEW_MEXICO_PRIMARY_GEOGRAPHY_DBF_MISSING");
  const value = validateNewMexicoPrimaryGeographyCandidate(buildNewMexicoPrimaryGeographyCandidate({
    proposal: JSON.parse(proposal.toString("utf8")), proposalFileSha256: sha256(proposal),
    receipt: JSON.parse(receipt.toString("utf8")), receiptFileSha256: sha256(receipt),
    identity: JSON.parse(identity.toString("utf8")), identityFileSha256: sha256(identity),
    authorityHtml: authority.toString("utf8"), authorityFileSha256: sha256(authority),
    nm118Dbf: Buffer.from(nm118Dbf), nm118FileSha256: sha256(nm118),
    nm119Dbf: Buffer.from(nm119Dbf), nm119FileSha256: sha256(nm119),
    sourceLock: JSON.parse(sourceLock.toString("utf8")),
  }));
  const output = "data/metadata/new-mexico-primary-geography-compatibility-candidate-v1.json";
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try {
    await writeFile(output, bytes, { flag: "wx", mode: 0o644 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("NEW_MEXICO_PRIMARY_GEOGRAPHY_OUTPUT_CONFLICT");
  }
  console.log(JSON.stringify({ output, byteSize: bytes.length, sha256: sha256(bytes), packageSha256: value.packageSha256, rowSetSha256: value.rowSetSha256, summary: value.summary }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
