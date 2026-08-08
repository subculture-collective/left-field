import { readFile, writeFile } from "node:fs/promises";

import { buildCountyCvapProjection } from "@/rapid-acquisition/county-cvap";

const output = "data/metadata/rapid-county-cvap-projection-v1.json";
async function main() {
  const bytes = Buffer.from(`${JSON.stringify(buildCountyCvapProjection(), null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx" }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw error; }
}
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "COUNTY_CVAP_GENERATION_FAILED"}\n`); process.exitCode = 1; });
