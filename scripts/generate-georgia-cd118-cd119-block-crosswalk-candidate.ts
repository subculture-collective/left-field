import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import {
  buildGeorgiaCd118Cd119BlockCrosswalkCandidate,
  validateGeorgiaCd118Cd119BlockCrosswalkCandidate,
} from "../src/ingestion/elections/georgia-cd118-cd119-block-crosswalk-candidate";

const sha = (value: Buffer): string => createHash("sha256").update(value).digest("hex");

async function main(): Promise<void> {
  const input = {
    authorityBytes: await readFile("data/source/elections/primary-results/geography/census-119-congressional-district-bef.html"),
    cd118Bytes: await readFile("data/source/elections/primary-results/geography/georgia/historical/13_GA_CD118.txt"),
    cd119Bytes: await readFile("data/source/elections/primary-results/geography/georgia/current/13_GA_CD119.txt"),
    sourceLock: JSON.parse((await readFile("data/source-lock.json")).toString("utf8")),
  };
  const value = validateGeorgiaCd118Cd119BlockCrosswalkCandidate(buildGeorgiaCd118Cd119BlockCrosswalkCandidate(input), input);
  const output = "data/metadata/georgia-cd118-cd119-block-crosswalk-candidate-v1.json";
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("GA_CD118_CD119_BLOCK_CROSSWALK_OUTPUT_CONFLICT");
  }
  console.log(JSON.stringify({ output, byteSize: bytes.length, sha256: sha(bytes), packageSha256: value.packageSha256, rowSetSha256: value.rowSetSha256, summary: value.summary }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
