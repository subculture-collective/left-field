import { readFile } from "node:fs/promises";

import { retainRapidSource } from "./retain-source";

const sources = [
  {
    sourceId: "in-2026-primary-settings",
    url: "https://enr.indianavoters.in.gov/site/data/settings.json",
    outputPath: "house-primary/in/2026/settings.json",
    expectedBytes: 3_249,
    expectedSha256: "a5fc6ec16d7ff91492ebc8b1d2d58959ee38f21bf0daeec87abb67d006122601",
  },
  {
    sourceId: "in-2026-primary-us-house-results",
    url: "https://enr.indianavoters.in.gov/site/data/OffCatC_1005_A.json",
    outputPath: "house-primary/in/2026/us-house-results.json",
    expectedBytes: 192_012,
    expectedSha256: "422cb0a21cd53eaf24177c97f8c4b4b8f6a30e2420264a2db4d1785ed610b65d",
  },
] as const;

async function main() {
  const sourceLockBytes = await readFile("data/source-lock.json");
  for (const source of sources) {
    const result = await retainRapidSource({ ...source, sourceLockBytes });
    process.stdout.write(`${JSON.stringify(result.sourceLockEntryCandidate)}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "INDIANA_2026_ACQUISITION_FAILED"}\n`);
  process.exitCode = 1;
});
