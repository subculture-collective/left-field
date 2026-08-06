import { mkdtempSync, readFileSync, writeFileSync, cpSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = resolve("scripts/fetch-connecticut-primary-nomination-authority.mjs");
const inspected = "/home/onnwee/.local/state/codex-desktop/tmp/tmp.66dGF5K937";

describe("Connecticut primary nomination authority acquisition", () => {
  it("replays exact official bytes while retaining only privacy-safe index pages", () => {
    const work = mkdtempSync(join(tmpdir(), "dsa-seats-ct-nomination-"));
    const cache = join(work, "cache");
    cpSync(inspected, cache, { recursive: true });
    const run = spawnSync(process.execPath, [script], { cwd: work, env: { ...process.env, DSA_SEATS_CT_NOMINATION_AUTHORITY_CACHE_DIR: cache }, encoding: "utf8" });
    expect(run.status, run.stderr).toBe(0);
    expect(JSON.parse(run.stdout).verifiedSources).toBe(14);
    expect(readFileSync(join(work, "data/source/elections/primary-results/connecticut/authority/2022-endorsement-certificate-index.html"))).toEqual(readFileSync(join(cache, "2022.html")));
    expect(existsSync(join(work, "data/source/elections/primary-results/connecticut/authority/ct-2022-cd-01.pdf"))).toBe(false);
    writeFileSync(join(cache, "source-9.pdf"), Buffer.from("drift"));
    const drift = spawnSync(process.execPath, [script], { cwd: work, env: { ...process.env, DSA_SEATS_CT_NOMINATION_AUTHORITY_CACHE_DIR: cache }, encoding: "utf8" });
    expect(drift.status).not.toBe(0);
    expect(drift.stderr).toContain("CT_NOMINATION_AUTHORITY_SOURCE_DRIFT");
  });
});
