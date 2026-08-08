import { readFile } from "node:fs/promises";

import { retainRapidSource } from "./retain-source";

const sources = [
  { sourceId: "in-2022-primary-state-senate-results", url: "https://enr.indianavoters.in.gov/archive/2022Primary/data/OffCatC_1018_A.json", outputPath: "state-legislative/in/2022/state-senate-results.json", expectedBytes: 91339, expectedSha256: "df629e92fc223a76142707b3c86b0a0d53465031ac09ccf3e692ac590d621528" },
  { sourceId: "in-2022-primary-state-house-results", url: "https://enr.indianavoters.in.gov/archive/2022Primary/data/OffCatC_1039_A.json", outputPath: "state-legislative/in/2022/state-house-results.json", expectedBytes: 308947, expectedSha256: "102ba50fe341f1b30f17ac69f80c0f26dbcc59de62ebbd313817c0904b854c67" },
  { sourceId: "in-2024-primary-state-senate-results", url: "https://enr.indianavoters.in.gov/archive/2024Primary/data/OffCatC_1018_B.json", outputPath: "state-legislative/in/2024/state-senate-results.json", expectedBytes: 76767, expectedSha256: "ab4459eb9167726633102e447814af7dea2903b394b872685f9aec51ddb69bd6" },
  { sourceId: "in-2024-primary-state-house-results", url: "https://enr.indianavoters.in.gov/archive/2024Primary/data/OffCatC_1039_B.json", outputPath: "state-legislative/in/2024/state-house-results.json", expectedBytes: 296437, expectedSha256: "63aca0ab21d7296dc54362d53197912a24d31b97af42e8051f3a3a3ceaab4fd8" },
] as const;
async function main() { const sourceLockBytes = await readFile("data/source-lock.json"); const results = []; for (const source of sources) results.push(await retainRapidSource({ ...source, sourceLockBytes })); process.stdout.write(`${JSON.stringify(results, null, 2)}\n`); }
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "INDIANA_STATE_LEGISLATIVE_ACQUISITION_FAILED"}\n`); process.exitCode = 1; });
