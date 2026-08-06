import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { buildCaliforniaSplitCrosswalkPolicyDossier } from "../src/ingestion/elections/california-split-crosswalk-policy-dossier";

const sha = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

async function main() {
  const [crosswalk, geography, joint, sourceLock] = await Promise.all([
    readFile("data/metadata/california-2026-primary-block-crosswalk-candidate-v1.json", "utf8"),
    readFile("data/metadata/california-primary-geography-compatibility-candidate-v2.json", "utf8"),
    readFile("data/metadata/california-primary-identity-geography-review-package-v2.json", "utf8"),
    readFile("data/source-lock.json", "utf8"),
  ]);
  const value = buildCaliforniaSplitCrosswalkPolicyDossier({ crosswalkJson: crosswalk, geographyJson: geography, jointJson: joint, sourceLock: JSON.parse(sourceLock) });
  const output = "data/metadata/california-split-crosswalk-policy-dossier-v1.json";
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("CA_SPLIT_CROSSWALK_POLICY_OUTPUT_CONFLICT");
  }
  process.stdout.write(`${JSON.stringify({ output, byteSize: bytes.length, sha256: sha(bytes), packageSha256: value.packageSha256, rowSetSha256: value.rowSetSha256, summary: value.summary }, null, 2)}\n`);
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
