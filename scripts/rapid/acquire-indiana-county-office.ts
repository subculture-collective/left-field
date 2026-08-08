import { readFile } from "node:fs/promises";

import { retainRapidSource } from "./retain-source";

const sources = [
  { sourceId: "in-2024-primary-office-category-index", url: "https://enr.indianavoters.in.gov/archive/2024Primary/data/statewideElectionsC_B.json", outputPath: "county-office/in/2024/office-category-index.json", expectedBytes: 17718, expectedSha256: "4050f57f74bd148bd09ad6721107db073f13872ec28c43a98811ac3d5bf03304" },
  { sourceId: "in-2024-primary-county-commissioner-results", url: "https://enr.indianavoters.in.gov/archive/2024Primary/data/OffCatC_1024_B.json", outputPath: "county-office/in/2024/county-commissioner-results.json", expectedBytes: 388315, expectedSha256: "6819c7264521b1b0a2b40dce35bf4c2743602e1337f3b855d205843f94cb0b6f" },
] as const;
async function main() { const sourceLockBytes = await readFile("data/source-lock.json"); for (const source of sources) await retainRapidSource({ ...source, sourceLockBytes }); }
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "INDIANA_COUNTY_OFFICE_ACQUISITION_FAILED"}\n`); process.exitCode = 1; });
