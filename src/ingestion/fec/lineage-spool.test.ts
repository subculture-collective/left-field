import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FecV2LineageSpool } from "./lineage-spool";

const row = { fileNumber: 1, pageSha256: "a".repeat(64), pass: 1 as const, occurrenceIndex: 1 };
describe("FEC V2 lineage spool", () => {
  it("is private, bounded, streams metadata, and cleans up", async () => {
    const root = await mkdtemp(join(tmpdir(), "fec-spool-test-")), spool = await FecV2LineageSpool.create({ tempRoot: root, maxRows: 1 });
    await expect(stat(spool.testingPath)).resolves.toMatchObject({ mode: expect.any(Number) });
    await spool.append(row); await expect(spool.append({ ...row, fileNumber: 2 })).rejects.toThrow("FEC_V2_LINEAGE_SPOOL_LIMIT");
    await expect((async () => { const rows = []; for await (const value of spool.read()) rows.push(value); return rows; })()).resolves.toEqual([row]);
    const path = spool.testingPath; await spool.cleanup(); await expect(stat(path)).rejects.toThrow();
  });
  it("rejects malformed rows and always cleans up after failure", async () => {
    const spool = await FecV2LineageSpool.create({ maxBytes: 1 }); const path = spool.testingPath;
    await expect(spool.append(row)).rejects.toThrow("FEC_V2_LINEAGE_SPOOL_LIMIT"); await spool.cleanup(); await expect(stat(path)).rejects.toThrow();
  });
});
