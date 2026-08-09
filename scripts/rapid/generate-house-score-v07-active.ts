import { readFile, writeFile } from "node:fs/promises";

import { buildHouseScoreV07ActiveProjection } from "@/rapid-acquisition/house-score-v07-active";

const output = "data/metadata/house-score-v07-active-projection-v1.json";

async function main() {
  const bytes = Buffer.from(`${JSON.stringify(buildHouseScoreV07ActiveProjection(), null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx" }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw error; }
}

if (require.main === module) main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "HOUSE_V07_ACTIVE_GENERATION_FAILED"}\n`);
  process.exitCode = 1;
});
