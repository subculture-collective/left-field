import { readFile, writeFile } from "node:fs/promises";

import { buildOhioStateLegislativeResults } from "@/rapid-acquisition/ohio-state-legislative-results";

const path =
  "data/metadata/rapid-ohio-state-legislative-democratic-primary-results-v1.json";

async function main(): Promise<void> {
  const bytes = Buffer.from(
    `${JSON.stringify(buildOhioStateLegislativeResults(), null, 2)}\n`,
  );
  try {
    await writeFile(path, bytes, { flag: "wx" });
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code !== "EEXIST" ||
      !(await readFile(path)).equals(bytes)
    )
      throw error;
  }
}

if (require.main === module)
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "OHIO_STATE_LEGISLATIVE_GENERATION_FAILED"}\n`,
    );
    process.exitCode = 1;
  });
