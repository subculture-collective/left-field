import { readFile, writeFile } from "node:fs/promises";

import { buildHouseScoreV05ActiveProjection } from "@/rapid-acquisition/house-score-v05-active";

const output = "data/metadata/house-score-v05-active-projection-v1.json";

async function main() {
  const bytes = Buffer.from(`${JSON.stringify(buildHouseScoreV05ActiveProjection(), null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx" }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw error; }
}

if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "HOUSE_V05_ACTIVE_GENERATION_FAILED"}\n`); process.exitCode = 1; });
