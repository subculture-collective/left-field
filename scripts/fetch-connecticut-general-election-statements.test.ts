import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script=resolve("scripts/fetch-connecticut-general-election-statements.mjs");
describe("Connecticut general-election Statement of Vote acquisition",()=>{
  it("describes two pinned privacy-safe official statements",()=>{
    const run=spawnSync(process.execPath,[script],{env:{...process.env,DSA_SEATS_CT_GENERAL_STATEMENTS_DESCRIBE:"1"},encoding:"utf8"});
    expect(run.status,run.stderr).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual({verifiedSources:2,retainedSources:2,sources:[{cycleYear:2022,byteSize:2290328,sha256:"1b6ca3708890241c387320e68b5e628f27a3bbc08b83b0d172e5d7bd9183664b"},{cycleYear:2024,byteSize:3139465,sha256:"1043dc18895adcff95e227e136eb19ef1c65f2a452a4dc97105fb4738cf3751c"}]});
  });

  it("rejects cache drift before writing either statement",()=>{
    const work=mkdtempSync(join(tmpdir(),"dsa-seats-ct-general-")),cache=join(work,"cache");mkdirSync(cache);writeFileSync(join(cache,"2022.pdf"),"drift");
    const run=spawnSync(process.execPath,[script],{cwd:work,env:{...process.env,DSA_SEATS_CT_GENERAL_STATEMENTS_CACHE_DIR:cache},encoding:"utf8"});
    expect(run.status).not.toBe(0);expect(run.stderr).toContain("CT_GENERAL_STATEMENT_SOURCE_DRIFT");
  });
});
