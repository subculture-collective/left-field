import { readFile } from "node:fs/promises";

import { retainRapidSource } from "./retain-source";

const source = {
  sourceId: "medsl-2024-senate-county-results",
  url: "https://raw.githubusercontent.com/MEDSL/2024-elections-official/df531089c78e6d0098db1a6bfb3849a066a06995/2024-senate-county.csv",
  outputPath: "county-senate-results/2024-senate-county.csv",
  expectedBytes: 1170326,
  expectedSha256: "6bb49fe67db5a7dcf30862fab81effc0fcfa456cb41326dd5fa9cd9fb8c60b81",
} as const;

async function main() { process.stdout.write(`${JSON.stringify(await retainRapidSource({ ...source, sourceLockBytes: await readFile("data/source-lock.json") }), null, 2)}\n`); }
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "COUNTY_SENATE_RESULTS_ACQUISITION_FAILED"}\n`); process.exitCode = 1; });
