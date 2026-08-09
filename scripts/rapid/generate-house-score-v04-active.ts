import { readFile, writeFile } from "node:fs/promises";

import { buildHouseScoreV04ActiveProjection } from "@/rapid-acquisition/house-score-v04-active";

const output = "data/metadata/house-score-v04-active-projection-v1.json";
async function main() {
  const bytes = Buffer.from(`${JSON.stringify(buildHouseScoreV04ActiveProjection(), null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx" }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw error; }
}
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "HOUSE_V04_ACTIVE_GENERATION_FAILED"}\n`); process.exitCode = 1; });
