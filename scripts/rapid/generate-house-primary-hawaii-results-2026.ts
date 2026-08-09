import { readFile, writeFile } from "node:fs/promises";

import { buildHawaiiPrimaryResults2026 } from "@/rapid-acquisition/house-primary-hawaii-results-2026";

const path = "data/metadata/rapid-house-primary-hawaii-results-2026-v1.json";

async function main() {
  const bytes = Buffer.from(`${JSON.stringify(buildHawaiiPrimaryResults2026(), null, 2)}\n`);
  try { await writeFile(path, bytes, { flag: "wx" }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw error; }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "HAWAII_2026_GENERATION_FAILED"}\n`);
  process.exitCode = 1;
});
