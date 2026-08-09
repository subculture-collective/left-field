import { readFile, writeFile } from "node:fs/promises";

import { buildSouthDakotaCountyFipsNormalization } from "@/rapid-acquisition/south-dakota-county-fips-normalization";

const output = "data/metadata/rapid-south-dakota-county-fips-normalization-v1.json";

async function main() {
  const bytes = Buffer.from(`${JSON.stringify(buildSouthDakotaCountyFipsNormalization(), null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx" }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw error; }
}

if (require.main === module) main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "SD_FIPS_NORMALIZATION_GENERATION_FAILED"}\n`);
  process.exitCode = 1;
});
