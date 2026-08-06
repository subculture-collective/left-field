import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { buildCaliforniaPrimaryIdentityGeographyReviewPackageV2 } from "../src/ingestion/elections/california-primary-identity-geography-review-package-v2";

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

async function main() {
  const [jointV1, geographyV2, geographyV1, crosswalk, currentStatusBytes, voterGuideBytes, sourcePageBytes, planBlocksBytes, currentBlocksBytes, sourceLockBytes] = await Promise.all([
    readFile("data/metadata/california-primary-identity-geography-review-package-v1.json"),
    readFile("data/metadata/california-primary-geography-compatibility-candidate-v2.json"),
    readFile("data/metadata/california-primary-geography-compatibility-candidate-v1.json"),
    readFile("data/metadata/california-2026-primary-block-crosswalk-candidate-v1.json"),
    readFile("data/source/elections/primary-results/geography/california/2026/california-redistricting-status.html"),
    readFile("data/source/elections/primary-results/geography/california/2026/prop50-official-voter-guide.pdf"),
    readFile("data/source/elections/primary-results/geography/california/2026/2025-congressional-districts.html"),
    readFile("data/source/elections/primary-results/geography/california/2026/06_CA_CD120_AB604.txt"),
    readFile("data/source/elections/primary-results/geography/california/current/06_CA_CD119.txt"),
    readFile("data/source-lock.json"),
  ]);
  const value = buildCaliforniaPrimaryIdentityGeographyReviewPackageV2({
    jointV1Json: jointV1.toString("utf8"),
    geographyV2Json: geographyV2.toString("utf8"),
    geographyV1Json: geographyV1.toString("utf8"),
    crosswalkJson: crosswalk.toString("utf8"),
    currentStatusBytes,
    voterGuideBytes,
    sourcePageBytes,
    planBlocksBytes,
    currentBlocksBytes,
    sourceLock: JSON.parse(sourceLockBytes.toString("utf8")),
  });
  const output = "data/metadata/california-primary-identity-geography-review-package-v2.json";
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try {
    await writeFile(output, bytes, { flag: "wx", mode: 0o644 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("CALIFORNIA_PRIMARY_JOINT_V2_OUTPUT_CONFLICT");
  }
  process.stdout.write(`${JSON.stringify({ output, byteSize: bytes.length, sha256: sha(bytes), packageSha256: value.packageSha256, reviewRecordSetSha256: value.reviewRecordSetSha256, summary: value.summary }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
