import { readFile, writeFile } from "node:fs/promises";

import { buildMississippiPrimaryResultsV3 } from "@/rapid-acquisition/house-primary-mississippi-results-v3";

const path = "data/metadata/rapid-house-primary-mississippi-results-v3.json";
const bytes = Buffer.from(`${JSON.stringify(buildMississippiPrimaryResultsV3(), null, 2)}\n`);

writeFile(path, bytes, { flag: "wx" }).catch(async (error) => {
  if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(path)).equals(bytes)) {
    process.stderr.write(`${error instanceof Error ? error.message : "MISSISSIPPI_RESULTS_V3_GENERATION_FAILED"}\n`);
    process.exitCode = 1;
  }
});
