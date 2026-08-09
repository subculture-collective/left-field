import { readFile, writeFile } from "node:fs/promises";

import {
  buildHousePrimaryCoverageLedgerV18,
  buildHousePrimaryProjectionV18,
} from "@/rapid-acquisition/house-primary-projection-v18";

const outputs = [
  ["data/metadata/rapid-house-primary-projection-v18.json", () => buildHousePrimaryProjectionV18()],
  ["data/metadata/rapid-house-primary-coverage-ledger-v18.json", () => buildHousePrimaryCoverageLedgerV18()],
] as const;

async function main() {
  for (const [path, build] of outputs) {
    const bytes = Buffer.from(`${JSON.stringify(build(), null, 2)}\n`);
    try {
      await writeFile(path, bytes, { flag: "wx" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw error;
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "PROJECTION_V18_GENERATION_FAILED"}\n`);
  process.exitCode = 1;
});
