import { readFile } from "node:fs/promises";

import { retainRapidSource } from "./retain-source";

const sources = [
  {
    sourceId: "census-acs2024-5yr-table-b01001",
    url: "https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-b01001.dat",
    outputPath: "county-demographics/acsdt5y2024-b01001.dat",
    expectedBytes: 200356282,
    expectedSha256: "1637b18a96881b81e050df1cd3d5ac38a33208b9b69b40e1dbeb3c4e13718f0e",
  },
  {
    sourceId: "census-acs2024-5yr-table-b01003",
    url: "https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-b01003.dat",
    outputPath: "county-demographics/acsdt5y2024-b01003.dat",
    expectedBytes: 18313708,
    expectedSha256: "38d1a992bb058d184009b10b9b34987279aee575e4323165cfb5706c69b6ca90",
  },
  {
    sourceId: "census-acs2024-5yr-table-b19013",
    url: "https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-b19013.dat",
    outputPath: "county-demographics/acsdt5y2024-b19013.dat",
    expectedBytes: 17917916,
    expectedSha256: "b25a176b0e6c339b6f3a2a0d3d8446bf06f5f080b4395993ec9a8313efb1c229",
  },
  {
    sourceId: "census-acs2024-5yr-table-b25003",
    url: "https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-b25003.dat",
    outputPath: "county-demographics/acsdt5y2024-b25003.dat",
    expectedBytes: 26901770,
    expectedSha256: "68e963e1ed60fcf6b0658579cefc6498b7a9eb780b9f3e87fd1b9775c4d4ac6c",
  },
  {
    sourceId: "census-2024-gazetteer-counties-national",
    url: "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_counties_national.zip",
    outputPath: "county-demographics/2024_Gaz_counties_national.zip",
    expectedBytes: 141679,
    expectedSha256: "3c337402b5c6e8d5aa26b4278ccf4edc8989f2683765b3ffbf22296cdb2df3a0",
  },
] as const;

async function main() {
  const sourceLockBytes = await readFile("data/source-lock.json");
  const results = [];
  for (const source of sources) results.push(await retainRapidSource({ ...source, sourceLockBytes }));
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
}

if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "COUNTY_DEMOGRAPHICS_ACQUISITION_FAILED"}\n`); process.exitCode = 1; });
