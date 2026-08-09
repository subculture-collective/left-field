import { readFile } from "node:fs/promises";

import { retainRapidSource } from "./retain-source";

async function main() {
  const result = await retainRapidSource({
    sourceId: "census-county-changes-2010s-20260809",
    url: "https://www.census.gov/programs-surveys/geography/technical-documentation/county-changes.2010.html",
    outputPath: "geography/census-county-changes-2010s.html",
    expectedBytes: 329_445,
    expectedSha256: "edbee4c6ab07c5c544e5161bf5b5b0afe06829aa23ce2b8b91f9931e81cf992c",
    sourceLockBytes: await readFile("data/source-lock.json"),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "SD_FIPS_AUTHORITY_ACQUISITION_FAILED"}\n`);
  process.exitCode = 1;
});
