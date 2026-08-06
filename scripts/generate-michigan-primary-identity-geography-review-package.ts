import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { buildMichiganPrimaryJointReviewPackage } from "../src/ingestion/elections/michigan-primary-identity-geography-review-package";

const sha256 = (value: Buffer): string => createHash("sha256").update(value).digest("hex");

async function main(): Promise<void> {
  const proposalJson = await readFile("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "utf8");
  const identityJson = await readFile("data/metadata/michigan-current-incumbent-primary-linkage-candidate-v1.json", "utf8");
  const geographyJson = await readFile("data/metadata/michigan-primary-geography-compatibility-candidate-v1.json", "utf8");
  const sourceLockJson = await readFile("data/source-lock.json", "utf8");
  const value = buildMichiganPrimaryJointReviewPackage({ proposalJson, identityJson, geographyJson, sourceLockJson });
  const output = "data/metadata/michigan-primary-identity-geography-review-package-v1.json";
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try {
    await writeFile(output, bytes, { flag: "wx", mode: 0o644 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) {
      throw new Error("MICHIGAN_PRIMARY_JOINT_OUTPUT_CONFLICT");
    }
  }
  console.log(JSON.stringify({
    output,
    byteSize: bytes.length,
    sha256: sha256(bytes),
    packageSha256: value.packageSha256,
    reviewRecordSetSha256: value.reviewRecordSetSha256,
    decisionSetSha256: value.decisionSetSha256,
    parentProjectionSha256: value.methodology.parentProjectionSha256,
    summary: value.summary,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
