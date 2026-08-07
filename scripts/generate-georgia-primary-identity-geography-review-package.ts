import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { buildGeorgiaPrimaryJointReviewPackage, validateGeorgiaPrimaryJointReviewPackage } from "../src/ingestion/elections/georgia-primary-identity-geography-review-package";
const sha = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
async function main(): Promise<void> {
  const [proposalJson, identityJson, geographyJson, sourceLockJson] = await Promise.all([readFile("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "utf8"), readFile("data/metadata/georgia-current-incumbent-primary-linkage-candidate-v1.json", "utf8"), readFile("data/metadata/georgia-primary-geography-compatibility-candidate-v1.json", "utf8"), readFile("data/source-lock.json", "utf8")]);
  const value = validateGeorgiaPrimaryJointReviewPackage(buildGeorgiaPrimaryJointReviewPackage({ proposalJson, identityJson, geographyJson, sourceLockJson }));
  const output = "data/metadata/georgia-primary-identity-geography-review-package-v1.json", bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("GEORGIA_PRIMARY_JOINT_OUTPUT_CONFLICT"); }
  console.log(JSON.stringify({ output, byteSize: bytes.length, sha256: sha(bytes), packageSha256: value.packageSha256, reviewRecordSetSha256: value.reviewRecordSetSha256, decisionSetSha256: value.decisionSetSha256, summary: value.summary }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
