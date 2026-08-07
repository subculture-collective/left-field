import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildDsaTargetProvisionalScoreV02 } from "../src/domain/dsa-target-provisional-score-v02";
const load = async (path: string): Promise<{ value: unknown; sha256: string }> => { const bytes = await readFile(path); return { value: JSON.parse(bytes.toString("utf8")), sha256: createHash("sha256").update(bytes).digest("hex") }; };
async function main(): Promise<void> {
  const [baseline, alignment, lock] = await Promise.all([load("data/metadata/dsa-target-evaluation-review-report-20260805-v6.json"), load("data/metadata/incumbent-alignment-tracker-candidate-20260807-v1.json"), readFile("data/source-lock.json")]);
  const value = buildDsaTargetProvisionalScoreV02({ baseline: baseline.value, baselineFileSha256: baseline.sha256, alignment: alignment.value, alignmentFileSha256: alignment.sha256, sourceLock: JSON.parse(lock.toString("utf8")) });
  const output = resolve("data/metadata/dsa-target-provisional-score-20260807-v02.json"), bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("DSA_PROVISIONAL_V02_OUTPUT_CONFLICT"); }
  const top = value.rows.filter((row) => row.provisionalRank !== null).sort((a, b) => a.provisionalRank! - b.provisionalRank!).slice(0, 20).map((row) => ({ rank: row.provisionalRank, seat: `${row.stateCode}-${row.districtCode}`, incumbent: row.incumbentName, score: row.provisionalTargetScore, route: row.baselineSelectedRoute, alignmentGap: row.components.incumbentAlignmentGap.score }));
  process.stdout.write(`${JSON.stringify({ output, bytes: bytes.length, summary: value.summary, top, rowSetSha256: value.rowSetSha256, packageSha256: value.packageSha256 }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "DSA_PROVISIONAL_V02_GENERATION_FAILED"}\n`); process.exitCode = 1; });
