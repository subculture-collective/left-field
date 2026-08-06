import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script=resolve("scripts/fetch-connecticut-nomination-statutes.mjs");
describe("Connecticut cycle-specific nomination-statute acquisition",()=>{
  it("disables implicit curl configuration before applying verified TLS options",()=>{
    const source=readFileSync(script,"utf8");
    expect(source).toContain('execFileSync("curl",["-q","-fsSL","--cacert"');
    expect(source).not.toMatch(/"(?:-k|--insecure)"/);
  });

  it("describes four pinned official instruments and verified-chain recovery",()=>{
    const run=spawnSync(process.execPath,[script],{env:{...process.env,DSA_SEATS_CT_STATUTES_DESCRIBE:"1"},encoding:"utf8"});
    expect(run.status,run.stderr).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual({verifiedSources:4,retainedSources:4,tlsRecovery:{reason:"server_omits_intermediate",verificationDisabled:false,intermediateSha256:"973a41276ffd01e027a2aad49e34c37846d3e976ff6a620b6712e33832041aa6"},sources:[{id:"ct-2021-chapter-153",byteSize:371695,sha256:"a7b5d6cfff1f702eda31605f37ffbe82afe6c7228c5aa0be08a602101e6c6e33"},{id:"ct-2022-chapter-153-supplement",byteSize:51593,sha256:"955ff66d75f59c30679399e51bfcbce34eed1d2d34099eada7ed08ec8d852b64"},{id:"ct-2023-chapter-153",byteSize:389864,sha256:"f422baa761ad7fbcff8a8883e997ca0077c6b1f940dcc1749b240b83f57c8c59"},{id:"ct-2024-chapter-153-supplement",byteSize:42304,sha256:"b6b1f2a94b17591a3447dad2e27cfb871b23f334f73b012702c5a5615c98331a"}]});
  });

  it("rejects cache drift before writing protected statutory sources",()=>{
    const work=mkdtempSync(join(tmpdir(),"dsa-seats-ct-statutes-")),cache=join(work,"cache");mkdirSync(cache);writeFileSync(join(cache,"2021-pub.html"),"drift");
    const run=spawnSync(process.execPath,[script],{cwd:work,env:{...process.env,DSA_SEATS_CT_STATUTES_CACHE_DIR:cache},encoding:"utf8"});
    expect(run.status).not.toBe(0);expect(run.stderr).toContain("CT_STATUTE_SOURCE_DRIFT:ct-2021-chapter-153");
  });
});
