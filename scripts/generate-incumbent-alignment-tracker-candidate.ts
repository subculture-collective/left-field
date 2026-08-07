import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildIncumbentAlignmentTrackerCandidate } from "../src/ingestion/scoring/incumbent-alignment-tracker-candidate";

async function main(): Promise<void> {
  const [leftBytes, palestineBytes, projectionBytes, lockBytes] = await Promise.all([
    readFile("data/source/scoring/incumbent-alignment/congressional-democrat-left-tracker-119th-house.xlsx"),
    readFile("data/source/scoring/incumbent-alignment/congressional-democrat-palestine-tracker-119th-house.xlsx"),
    readFile("data/metadata/dsa-target-factual-projection-20260804-v1.json"),
    readFile("data/source-lock.json"),
  ]);
  const value = buildIncumbentAlignmentTrackerCandidate({ leftBytes, palestineBytes, projection: JSON.parse(projectionBytes.toString("utf8")), projectionBytes, sourceLock: JSON.parse(lockBytes.toString("utf8")) });
  const output = resolve("data/metadata/incumbent-alignment-tracker-candidate-20260807-v1.json"), bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("INCUMBENT_ALIGNMENT_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, bytes: bytes.length, summary: value.summary, rowSetSha256: value.rowSetSha256, packageSha256: value.packageSha256 }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "INCUMBENT_ALIGNMENT_GENERATION_FAILED"}\n`); process.exitCode = 1; });
