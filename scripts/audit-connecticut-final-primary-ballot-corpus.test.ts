import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Connecticut retained ballot content audit", () => {
  it("describes the exact direct-text and OCR review boundary", () => {
    const run = spawnSync(process.execPath, [resolve("scripts/audit-connecticut-final-primary-ballot-corpus.mjs")], { env: { ...process.env, DSA_SEATS_CT_FINAL_PRIMARY_BALLOT_AUDIT_DESCRIBE: "1" }, encoding: "utf8" });
    expect(run.status, run.stderr).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual({ documents: 196, directTextDocuments: 193, ocrDocuments: 3, expectedCongressTokenOccurrences: 1, expectedHouseOfficeRows: 0 });
  });
});
