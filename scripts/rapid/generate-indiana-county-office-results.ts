import { readFile, writeFile } from "node:fs/promises";

import { buildIndianaCountyOfficeResults } from "@/rapid-acquisition/indiana-county-office-results";

const output = "data/metadata/rapid-indiana-county-commissioner-primary-results-v1.json";
async function main() {
  const bytes = Buffer.from(`${JSON.stringify(buildIndianaCountyOfficeResults(), null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx" }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw error; }
}
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "INDIANA_COUNTY_OFFICE_GENERATION_FAILED"}\n`); process.exitCode = 1; });
