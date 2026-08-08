import { readFile, writeFile } from "node:fs/promises";

import { buildHouseScoreV04ShadowProjection } from "@/rapid-acquisition/house-score-v04-shadow";

const output = "data/metadata/house-score-v04-shadow-projection-v1.json";
async function main() {
  const bytes = Buffer.from(`${JSON.stringify(buildHouseScoreV04ShadowProjection(), null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx" }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw error; }
}
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "HOUSE_V04_SHADOW_GENERATION_FAILED"}\n`); process.exitCode = 1; });
