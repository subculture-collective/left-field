import { readFile, writeFile } from "node:fs/promises";

import { buildWisconsinPrimaryResults } from "@/rapid-acquisition/house-primary-wisconsin-results";

const path = "data/metadata/rapid-house-primary-wisconsin-results-v1.json";
async function main() {
  const bytes = Buffer.from(`${JSON.stringify(buildWisconsinPrimaryResults(), null, 2)}\n`);
  try { await writeFile(path, bytes, { flag: "wx" }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw error; }
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "WISCONSIN_PRIMARY_GENERATION_FAILED"}\n`); process.exitCode = 1; });
