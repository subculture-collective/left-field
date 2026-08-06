import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { buildConnecticutFinalPrimaryBallotReceipt, validateConnecticutFinalPrimaryBallotReceipt } from "../src/ingestion/elections/connecticut-final-primary-ballot-receipt";

async function main() {
  const catalogBytes = await readFile("data/source/elections/primary-results/connecticut/ballots/source-catalog-v1.json");
  const sourceLock = JSON.parse(await readFile("data/source-lock.json", "utf8"));
  const input = { catalogBytes, sourceLock };
  const value = validateConnecticutFinalPrimaryBallotReceipt(buildConnecticutFinalPrimaryBallotReceipt(input), input);
  const output = "data/metadata/connecticut-final-primary-ballot-receipt-v1.json";
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("CT_FINAL_PRIMARY_BALLOT_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, byteSize: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), packageSha256: value.packageSha256, documentSetSha256: value.documentSetSha256, townRowSetSha256: value.townRowSetSha256, summary: value.summary }, null, 2)}\n`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
