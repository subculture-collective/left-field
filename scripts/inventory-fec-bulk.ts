import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readdirSync,
  readSync,
  realpathSync,
  statSync,
} from "node:fs";
import { relative, resolve } from "node:path";

export type InventoryRow = {
  filename: string;
  bytes: number;
  sha256: string;
  classification: "bootstrap_candidate" | "prohibited_unopened" | "unclassified";
  duplicateHashGroup: string | null;
};

const normalizedArchiveName = (name: string): string =>
  name.replace(/ \(\d+\)(?=\.zip$)/, "");
const classify = (name: string): InventoryRow["classification"] => {
  const normalized = normalizedArchiveName(name);
  if (/^(cn|cm|ccl|weball|webk|webl)\d+\.zip$/.test(normalized))
    return "bootstrap_candidate";
  if (/^(indiv|oth|pas2|oppexp)\d+\.zip$/.test(normalized))
    return "prohibited_unopened";
  return "unclassified";
};

export function inventoryFecBulk(root: string): readonly InventoryRow[] {
  const realRoot = realpathSync(root);
  const rootBefore = statSync(realRoot);
  if (!rootBefore.isDirectory()) throw new Error("FEC_INVENTORY_ROOT_INVALID");

  const base: Omit<InventoryRow, "duplicateHashGroup">[] = [];
  const names = readdirSync(realRoot)
    .filter((name) => name.toLowerCase().endsWith(".zip"))
    .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  for (const filename of names) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._() -]{0,180}\.zip$/.test(filename))
      throw new Error("FEC_INVENTORY_NAME_INVALID");
    const path = resolve(realRoot, filename);
    if (relative(realRoot, path) !== filename) throw new Error("FEC_INVENTORY_NAME_INVALID");
    const namedBefore = lstatSync(path);
    if (!namedBefore.isFile()) throw new Error("FEC_INVENTORY_FILE_INVALID");

    let descriptor = -1;
    try {
      descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      const openedBefore = fstatSync(descriptor);
      if (
        !openedBefore.isFile() ||
        openedBefore.dev !== namedBefore.dev ||
        openedBefore.ino !== namedBefore.ino
      ) throw new Error("FEC_INVENTORY_FILE_CHANGED");
      const hash = createHash("sha256");
      const buffer = Buffer.alloc(64 * 1024);
      for (let offset = 0; offset < openedBefore.size;) {
        const count = readSync(
          descriptor,
          buffer,
          0,
          Math.min(buffer.length, openedBefore.size - offset),
          offset,
        );
        if (!count) throw new Error("FEC_INVENTORY_FILE_CHANGED");
        hash.update(buffer.subarray(0, count));
        offset += count;
      }
      const openedAfter = fstatSync(descriptor);
      const namedAfter = lstatSync(path);
      const rootAfter = statSync(realRoot);
      if (
        openedBefore.dev !== openedAfter.dev ||
        openedBefore.ino !== openedAfter.ino ||
        openedBefore.size !== openedAfter.size ||
        namedAfter.dev !== openedBefore.dev ||
        namedAfter.ino !== openedBefore.ino ||
        !namedAfter.isFile() ||
        rootAfter.dev !== rootBefore.dev ||
        rootAfter.ino !== rootBefore.ino
      ) throw new Error("FEC_INVENTORY_FILE_CHANGED");
      base.push({
        filename,
        bytes: openedBefore.size,
        sha256: hash.digest("hex"),
        classification: classify(filename),
      });
    } finally {
      if (descriptor >= 0) closeSync(descriptor);
    }
  }

  const groups = new Map<string, number>();
  for (const row of base) groups.set(row.sha256, (groups.get(row.sha256) ?? 0) + 1);
  return base.map((row) => ({
    ...row,
    duplicateHashGroup: (groups.get(row.sha256) ?? 0) > 1 ? row.sha256 : null,
  }));
}

export function parseInventoryArgs(argv: readonly string[]): string {
  if (argv.length !== 2 || argv[0] !== "--root" || !argv[1])
    throw new Error("Require --root");
  return argv[1];
}

if (require.main === module) {
  try {
    process.stdout.write(`${JSON.stringify(inventoryFecBulk(parseInventoryArgs(process.argv.slice(2))))}\n`);
  } catch (error) {
    const message = error instanceof Error && /^FEC_INVENTORY_[A-Z_]+$/.test(error.message)
      ? error.message
      : "FEC_INVENTORY_FAILED";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
