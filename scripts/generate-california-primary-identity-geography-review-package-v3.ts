import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { buildCaliforniaPrimaryIdentityGeographyReviewPackageV3, validateCaliforniaPrimaryIdentityGeographyReviewPackageV3 } from "../src/ingestion/elections/california-primary-identity-geography-review-package-v3";

async function main() {
  const [jointV2, dossier, jointV1, geographyV2, geographyV1, crosswalk, currentStatusBytes, voterGuideBytes, sourcePageBytes, planBlocksBytes, currentBlocksBytes, sourceLockBytes] = await Promise.all([
    readFile("data/metadata/california-primary-identity-geography-review-package-v2.json", "utf8"),
    readFile("data/metadata/california-split-crosswalk-policy-dossier-v1.json", "utf8"),
    readFile("data/metadata/california-primary-identity-geography-review-package-v1.json", "utf8"),
    readFile("data/metadata/california-primary-geography-compatibility-candidate-v2.json", "utf8"),
    readFile("data/metadata/california-primary-geography-compatibility-candidate-v1.json", "utf8"),
    readFile("data/metadata/california-2026-primary-block-crosswalk-candidate-v1.json", "utf8"),
    readFile("data/source/elections/primary-results/geography/california/2026/california-redistricting-status.html"),
    readFile("data/source/elections/primary-results/geography/california/2026/prop50-official-voter-guide.pdf"),
    readFile("data/source/elections/primary-results/geography/california/2026/2025-congressional-districts.html"),
    readFile("data/source/elections/primary-results/geography/california/2026/06_CA_CD120_AB604.txt"),
    readFile("data/source/elections/primary-results/geography/california/current/06_CA_CD119.txt"),
    readFile("data/source-lock.json"),
  ]);
  const input = { jointV2Json: jointV2, policyDossierJson: dossier, jointV1Json: jointV1, geographyV2Json: geographyV2, geographyV1Json: geographyV1, crosswalkJson: crosswalk, currentStatusBytes, voterGuideBytes, sourcePageBytes, planBlocksBytes, currentBlocksBytes, sourceLock: JSON.parse(sourceLockBytes.toString("utf8")) };
  const value = validateCaliforniaPrimaryIdentityGeographyReviewPackageV3(buildCaliforniaPrimaryIdentityGeographyReviewPackageV3(input), input);
  const output = "data/metadata/california-primary-identity-geography-review-package-v3.json";
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("CALIFORNIA_PRIMARY_JOINT_V3_OUTPUT_CONFLICT"); }
  console.log(JSON.stringify({ output, byteSize: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), packageSha256: value.packageSha256, reviewRecordSetSha256: value.reviewRecordSetSha256, splitPolicyProjectionSetSha256: value.splitPolicyProjectionSetSha256, decisionReviewSetSha256: value.decisionReviewSetSha256, summary: value.summary }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
