import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildDsaTargetPriorityBriefsV1 } from "../src/domain/dsa-target-priority-briefs-v1";
const load = async (
  path: string,
): Promise<{ value: unknown; sha256: string }> => {
  const bytes = await readFile(path);
  return {
    value: JSON.parse(bytes.toString("utf8")),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
};
async function main(): Promise<void> {
  const [score, tenure, legislators, projection, lock] = await Promise.all([
    load("data/metadata/dsa-target-provisional-score-20260807-v02.json"),
    load("data/metadata/incumbent-tenure-factual-candidate-20260804-v1.json"),
    load("data/source/identity/congress-legislators-current-20260804.json"),
    load("data/metadata/dsa-target-factual-projection-20260804-v1.json"),
    readFile("data/source-lock.json"),
  ]);
  const value = buildDsaTargetPriorityBriefsV1({
    score: score.value,
    scoreFileSha256: score.sha256,
    tenure: tenure.value,
    tenureFileSha256: tenure.sha256,
    legislators: legislators.value,
    legislatorsFileSha256: legislators.sha256,
    projection: projection.value,
    projectionFileSha256: projection.sha256,
    sourceLock: JSON.parse(lock.toString("utf8")),
  });
  const output = resolve(
      "data/metadata/dsa-target-priority-briefs-20260807-v1.json",
    ),
    bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try {
    await writeFile(output, bytes, { flag: "wx", mode: 0o644 });
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code !== "EEXIST" ||
      !(await readFile(output)).equals(bytes)
    )
      throw new Error("DSA_PRIORITY_BRIEFS_OUTPUT_CONFLICT");
  }
  process.stdout.write(
    `${JSON.stringify({ output, bytes: bytes.length, summary: value.summary, defaultView: value.selection.defaultPublicViewCount, rank50Score: value.selection.rank50Score, briefSetSha256: value.briefSetSha256, packageSha256: value.packageSha256 }, null, 2)}\n`,
  );
}
main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "DSA_PRIORITY_BRIEFS_GENERATION_FAILED"}\n`,
  );
  process.exitCode = 1;
});
