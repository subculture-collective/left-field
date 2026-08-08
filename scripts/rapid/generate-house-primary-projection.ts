import { readFile, writeFile } from "node:fs/promises";

import { buildHousePrimaryCoverageLedger, buildHousePrimaryProjection } from "@/rapid-acquisition/house-primary-projection";

const outputs = [
  ["data/metadata/rapid-house-primary-projection-v1.json", () => buildHousePrimaryProjection()],
  ["data/metadata/rapid-house-primary-coverage-ledger-v1.json", () => buildHousePrimaryCoverageLedger()],
] as const;

async function createOnly(path: string, bytes: Buffer) {
  try { await writeFile(path, bytes, { flag: "wx" }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw error; }
}

async function main() {
  for (const [path, build] of outputs) await createOnly(path, Buffer.from(`${JSON.stringify(build(), null, 2)}\n`));
}

if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "PROJECTION_FAILED"}\n`); process.exitCode = 1; });
