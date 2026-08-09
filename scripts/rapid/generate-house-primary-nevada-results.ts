import { readFile, writeFile } from "node:fs/promises";

import { buildNevadaPrimaryResults } from "@/rapid-acquisition/house-primary-nevada-results";

const path = "data/metadata/rapid-house-primary-nevada-results-v1.json";
async function main() {
  const bytes = Buffer.from(`${JSON.stringify(buildNevadaPrimaryResults(), null, 2)}\n`);
  try { await writeFile(path, bytes, { flag: "wx" }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw error; }
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "NEVADA_PRIMARY_GENERATION_FAILED"}\n`); process.exitCode = 1; });
