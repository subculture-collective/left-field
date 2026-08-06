import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = resolve("scripts/fetch-connecticut-final-primary-ballots.mjs");

describe("Connecticut final primary ballot corpus acquisition", () => {
  it("describes two indexes and every linked Democratic ballot across 338 town-cycle rows", () => {
    const run = spawnSync(process.execPath, [script], { env: { ...process.env, DSA_SEATS_CT_FINAL_PRIMARY_BALLOTS_DESCRIBE: "1" }, encoding: "utf8" });
    expect(run.status, run.stderr).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual({
      verifiedSources: 198,
      retainedSources: 198,
      indexSources: 2,
      ballotSources: 196,
      townRows: 338,
      cycles: [
        { cycleYear: 2022, townRows: 169, democraticBallotLinks: 168 },
        { cycleYear: 2024, townRows: 169, democraticBallotLinks: 28 },
      ],
    });
  });

  it("rejects drift before writing protected source bytes", () => {
    const work = mkdtempSync(join(tmpdir(), "dsa-seats-ct-final-ballots-"));
    const cache = join(work, "cache");
    mkdirSync(cache);
    writeFileSync(join(cache, "ct-2022-primary-town-ballot-index.bin"), "drift");
    const run = spawnSync(process.execPath, [script], { cwd: work, env: { ...process.env, DSA_SEATS_CT_FINAL_PRIMARY_BALLOTS_CACHE_DIR: cache }, encoding: "utf8" });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain("CT_FINAL_PRIMARY_BALLOT_SOURCE_DRIFT:ct-2022-primary-town-ballot-index");
  });
});
