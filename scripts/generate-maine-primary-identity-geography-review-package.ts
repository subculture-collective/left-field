import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { buildMainePrimaryIdentityGeographyReviewPackage } from "../src/ingestion/elections/maine-primary-identity-geography-review-package";

const sha = (value: Buffer): string => createHash("sha256").update(value).digest("hex");

async function main(): Promise<void> {
  const [proposalJson, identityCandidateJson, geographyCandidateJson, sourceLockJson] = await Promise.all([
    readFile("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "utf8"),
    readFile("data/metadata/maine-current-incumbent-primary-linkage-candidate-v1.json", "utf8"),
    readFile("data/metadata/maine-primary-geography-compatibility-candidate-v1.json", "utf8"),
    readFile("data/source-lock.json", "utf8"),
  ]);
  const value = buildMainePrimaryIdentityGeographyReviewPackage({ proposalJson, identityCandidateJson, geographyCandidateJson, sourceLockJson });
  const output = "data/metadata/maine-primary-identity-geography-review-package-v1.json";
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try {
    await writeFile(output, bytes, { flag: "wx", mode: 0o644 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("MAINE_PRIMARY_IDENTITY_GEOGRAPHY_REVIEW_PACKAGE_OUTPUT_CONFLICT");
  }
  process.stdout.write(`${JSON.stringify({ output, byteSize: bytes.byteLength, sha256: sha(bytes), packageSha256: value.packageSha256, reviewRecordSetSha256: value.reviewRecordSetSha256, decisionSetSha256: value.decisionSetSha256, summary: value.summary }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
