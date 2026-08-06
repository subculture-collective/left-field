import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { buildNewYorkPrimaryJointReviewPackage } from "../src/ingestion/elections/new-york-primary-identity-geography-review-package";

const sha = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
const text = async (path: string): Promise<string> => (await readFile(path)).toString("utf8");

async function main(): Promise<void> {
  const value = buildNewYorkPrimaryJointReviewPackage({
    proposalJson: await text("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"),
    identityJson: await text("data/metadata/new-york-current-incumbent-primary-linkage-candidate-v1.json"),
    geographyJson: await text("data/metadata/new-york-primary-geography-compatibility-candidate-v1.json"),
    sourceLockJson: await text("data/source-lock.json"),
  });
  const output = "data/metadata/new-york-primary-identity-geography-review-package-v1.json";
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("NEW_YORK_PRIMARY_JOINT_OUTPUT_CONFLICT"); }
  console.log(JSON.stringify({ output, byteSize: bytes.length, sha256: sha(bytes), packageSha256: value.packageSha256, reviewRecordSetSha256: value.reviewRecordSetSha256, decisionSetSha256: value.decisionSetSha256, summary: value.summary }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
