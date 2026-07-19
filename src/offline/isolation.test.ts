import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const sourceRoot = join(root, "src");
async function productionFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "offline" || entry.name === "test" ? [] : productionFiles(path);
    return /\.(ts|tsx|mts|mjs)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name) ? [path] : [];
  }));
  return nested.flat();
}

describe("offline artifact isolation", () => {
  it("is not imported, required, or re-exported by production code/config", async () => {
    const configs = ["next.config.ts", "vitest.config.mts", "eslint.config.mjs"];
    const files = [...await productionFiles(sourceRoot), ...configs.map((file) => join(root, file))];
    const offlineReference = /(?:from\s*["'](?:@\/offline(?:\/|["'])|(?:\.\.?\/)+offline(?:\/|["']))|require\(\s*["'](?:@\/offline|(?:\.\.?\/)+offline)|import\(\s*["'](?:@\/offline|(?:\.\.?\/)+offline))/;
    const offenders = (await Promise.all(files.map(async (file) => offlineReference.test(await readFile(file, "utf8")) ? relative(root, file) : null))).filter(Boolean);
    expect(offenders).toEqual([]);
  });
  it("does not visibly claim rankings or evidence are published", async () => {
    const appFiles = await productionFiles(join(sourceRoot, "app"));
    const copy = (await Promise.all(appFiles.map((file) => readFile(file, "utf8")))).join("\n");
    expect(copy).not.toMatch(/(?:published\s+(?:rankings?|evidence)|(?:rankings?|evidence)\s+(?:are|is)\s+published)/i);
  });
});
