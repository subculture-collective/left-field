import { readFile, writeFile } from "node:fs/promises";

import { buildSouthCarolinaPrimaryResultsV2 } from "@/rapid-acquisition/house-primary-south-carolina-results-v2";

const path = "data/metadata/rapid-house-primary-south-carolina-results-v2.json";

async function main() {
  const bytes = Buffer.from(`${JSON.stringify(buildSouthCarolinaPrimaryResultsV2(), null, 2)}\n`);
  try { await writeFile(path, bytes, { flag: "wx" }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw error; }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "SOUTH_CAROLINA_RESULTS_V2_GENERATION_FAILED"}\n`);
  process.exitCode = 1;
});
