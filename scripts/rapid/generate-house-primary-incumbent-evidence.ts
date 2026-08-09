import { readFile, writeFile } from "node:fs/promises";

import { buildHousePrimaryIncumbentEvidence } from "@/rapid-acquisition/house-primary-incumbent-evidence";

const output = "data/metadata/rapid-house-primary-2024-incumbent-evidence-v1.json";

async function main() {
  const bytes = Buffer.from(`${JSON.stringify(buildHousePrimaryIncumbentEvidence(), null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx" }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw error; }
}

if (require.main === module) main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "HOUSE_PRIMARY_INCUMBENT_GENERATION_FAILED"}\n`);
  process.exitCode = 1;
});
