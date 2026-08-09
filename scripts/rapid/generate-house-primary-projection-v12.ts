import { readFile, writeFile } from "node:fs/promises";

import {
  buildHousePrimaryCoverageLedgerV12,
  buildHousePrimaryProjectionV12,
} from "@/rapid-acquisition/house-primary-projection-v12";

const outputs = [
  ["data/metadata/rapid-house-primary-projection-v12.json", () => buildHousePrimaryProjectionV12()],
  ["data/metadata/rapid-house-primary-coverage-ledger-v12.json", () => buildHousePrimaryCoverageLedgerV12()],
] as const;

async function main() {
  for (const [path, build] of outputs) {
    const bytes = Buffer.from(`${JSON.stringify(build(), null, 2)}\n`);
    try { await writeFile(path, bytes, { flag: "wx" }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw error; }
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "PROJECTION_V12_GENERATION_FAILED"}\n`);
  process.exitCode = 1;
});
