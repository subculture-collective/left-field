import { readFile, writeFile } from "node:fs/promises";

import { buildTennesseePrimaryResultsV2 } from "@/rapid-acquisition/house-primary-tennessee-results-v2";

async function main() {
  const path = "data/metadata/rapid-house-primary-tennessee-results-v2.json";
  const bytes = Buffer.from(`${JSON.stringify(buildTennesseePrimaryResultsV2(), null, 2)}\n`);
  try { await writeFile(path, bytes, { flag: "wx" }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw error; }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "TENNESSEE_RESULTS_V2_GENERATION_FAILED"}\n`);
  process.exitCode = 1;
});
