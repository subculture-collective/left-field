import { readFile } from "node:fs/promises";

import { retainRapidSource } from "./retain-source";

const sources = [
  { sourceId: "eac-2022-eavs-public-release-v1-1-csv", url: "https://www.eac.gov/sites/default/files/2023-12/2022_EAVS_for_Public_Release_nolabel_V1.1_CSV.zip", outputPath: "county-election-context/2022_EAVS_for_Public_Release_nolabel_V1.1_CSV.zip", expectedBytes: 2048270, expectedSha256: "063a38eca8ee1e82aa4b60ef33eee124a58bd288f10d05126957620719d32acc" },
  { sourceId: "eac-2024-eavs-public-release-v2-csv", url: "https://www.eac.gov/sites/default/files/2026-02/2024_EAVS_for_Public_Release_nolabel_V2_csv.zip", outputPath: "county-election-context/2024_EAVS_for_Public_Release_nolabel_V2_csv.zip", expectedBytes: 2119187, expectedSha256: "4073b9f48e1791d44a78ddc543379f6c040c31ce733dfa47676330b4d7f6d6df" },
] as const;

async function main() { const sourceLockBytes = await readFile("data/source-lock.json"); const results = []; for (const source of sources) results.push(await retainRapidSource({ ...source, sourceLockBytes })); process.stdout.write(`${JSON.stringify(results, null, 2)}\n`); }
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "COUNTY_ELECTION_CONTEXT_ACQUISITION_FAILED"}\n`); process.exitCode = 1; });
