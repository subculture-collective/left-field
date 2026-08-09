import { readFile, writeFile } from "node:fs/promises";

import { buildNewHampshirePrimaryResults } from "@/rapid-acquisition/house-primary-new-hampshire-results";

const path = "data/metadata/rapid-house-primary-new-hampshire-results-v1.json";
const bytes = Buffer.from(`${JSON.stringify(buildNewHampshirePrimaryResults(), null, 2)}\n`);
writeFile(path, bytes, { flag: "wx" }).catch(async (error) => {
  if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(path)).equals(bytes)) {
    process.stderr.write(`${error instanceof Error ? error.message : "NEW_HAMPSHIRE_RESULTS_GENERATION_FAILED"}\n`);
    process.exitCode = 1;
  }
});
