import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { buildMinnesotaPrimaryJointReviewPackage, validateMinnesotaPrimaryJointReviewPackage } from "../src/ingestion/elections/minnesota-primary-identity-geography-review-package";

const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

async function main(): Promise<void> {
  const [proposalJson, identityJson, geographyJson, sourceLockJson] = await Promise.all([
    readFile("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "utf8"),
    readFile("data/metadata/minnesota-current-incumbent-primary-linkage-candidate-v1.json", "utf8"),
    readFile("data/metadata/minnesota-primary-geography-compatibility-candidate-v1.json", "utf8"),
    readFile("data/source-lock.json", "utf8"),
  ]);
  const value = validateMinnesotaPrimaryJointReviewPackage(buildMinnesotaPrimaryJointReviewPackage({ proposalJson, identityJson, geographyJson, sourceLockJson }));
  const output = "data/metadata/minnesota-primary-identity-geography-review-package-v1.json";
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("MINNESOTA_PRIMARY_JOINT_OUTPUT_CONFLICT"); }
  console.log(JSON.stringify({ output, byteSize: bytes.length, sha256: sha256(bytes), packageSha256: value.packageSha256, parentProjectionSha256: value.parentProjectionSha256, reviewRecordSetSha256: value.reviewRecordSetSha256, decisionSetSha256: value.decisionSetSha256, summary: value.summary }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
