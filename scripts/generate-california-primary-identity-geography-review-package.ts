import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildCaliforniaPrimaryIdentityGeographyReviewPackage } from "../src/ingestion/elections/california-primary-identity-geography-review-package";

const load = async (path: string) => { const bytes = await readFile(resolve(path)); return { value: JSON.parse(bytes.toString("utf8")), sha256: createHash("sha256").update(bytes).digest("hex") }; };
async function main(): Promise<void> {
  const proposal = await load("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"), identity = await load("data/metadata/california-current-incumbent-primary-linkage-candidate-v1.json"), geography = await load("data/metadata/california-primary-geography-compatibility-candidate-v1.json"), sourceLock = await load("data/source-lock.json"), value = buildCaliforniaPrimaryIdentityGeographyReviewPackage({ proposal: proposal.value, proposalFileSha256: proposal.sha256, identity: identity.value, identityFileSha256: identity.sha256, geography: geography.value, geographyFileSha256: geography.sha256, sourceLock: sourceLock.value });
  const output = resolve("data/metadata/california-primary-identity-geography-review-package-v1.json"), bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("CA_PRIMARY_JOINT_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, summary: value.summary, reviewRecordSetSha256: value.reviewRecordSetSha256, packageSha256: value.packageSha256 }, null, 2)}\n`);
}
void main().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
