import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const sources=[
  {id:"ct-2021-chapter-153",url:"https://cga.ct.gov/2021/pub/chap_153.htm",cacheName:"2021-pub.html",output:"data/source/elections/primary-results/connecticut/statutes/2021-chapter-153.html",byteSize:371695,sha256:"a7b5d6cfff1f702eda31605f37ffbe82afe6c7228c5aa0be08a602101e6c6e33"},
  {id:"ct-2022-chapter-153-supplement",url:"https://cga.ct.gov/2022/sup/chap_153.htm",cacheName:"2022-sup.html",output:"data/source/elections/primary-results/connecticut/statutes/2022-chapter-153-supplement.html",byteSize:51593,sha256:"955ff66d75f59c30679399e51bfcbce34eed1d2d34099eada7ed08ec8d852b64"},
  {id:"ct-2023-chapter-153",url:"https://cga.ct.gov/2023/pub/chap_153.htm",cacheName:"2023-pub.html",output:"data/source/elections/primary-results/connecticut/statutes/2023-chapter-153.html",byteSize:389864,sha256:"f422baa761ad7fbcff8a8883e997ca0077c6b1f940dcc1749b240b83f57c8c59"},
  {id:"ct-2024-chapter-153-supplement",url:"https://cga.ct.gov/2024/sup/chap_153.htm",cacheName:"2024-sup.html",output:"data/source/elections/primary-results/connecticut/statutes/2024-chapter-153-supplement.html",byteSize:42304,sha256:"b6b1f2a94b17591a3447dad2e27cfb871b23f334f73b012702c5a5615c98331a"},
];
const intermediate={url:"http://certificates.godaddy.com/repository/gdig2.crt",byteSize:1236,sha256:"973a41276ffd01e027a2aad49e34c37846d3e976ff6a620b6712e33832041aa6"};
const cache=process.env.DSA_SEATS_CT_STATUTES_CACHE_DIR,hash=value=>createHash("sha256").update(value).digest("hex"),description={verifiedSources:4,retainedSources:4,tlsRecovery:{reason:"server_omits_intermediate",verificationDisabled:false,intermediateSha256:intermediate.sha256},sources:sources.map(({id,byteSize,sha256})=>({id,byteSize,sha256}))};
if(process.env.DSA_SEATS_CT_STATUTES_DESCRIBE==="1"){process.stdout.write(`${JSON.stringify(description)}\n`);process.exit(0);}
const verifySource=(source,bytes)=>{if(bytes.length!==source.byteSize||hash(bytes)!==source.sha256)throw new Error(`CT_STATUTE_SOURCE_DRIFT:${source.id}`);return bytes;};

let acquired;
if(cache){acquired=[];for(const source of sources)acquired.push(verifySource(source,await readFile(resolve(cache,source.cacheName))));}
else{
  const work=await mkdtemp(join(tmpdir(),"dsa-seats-ct-statutes-tls-"));
  try{
    const response=await fetch(intermediate.url,{signal:AbortSignal.timeout(60000),headers:{"user-agent":"dsa-seats-source-lock/1.0"}});if(!response.ok)throw new Error(`CT_STATUTE_INTERMEDIATE_HTTP:${response.status}`);const der=Buffer.from(await response.arrayBuffer());if(der.length!==intermediate.byteSize||hash(der)!==intermediate.sha256)throw new Error("CT_STATUTE_INTERMEDIATE_DRIFT");
    const derPath=join(work,"intermediate.der"),intermediatePath=join(work,"intermediate.pem"),leafPath=join(work,"leaf.pem"),caPath=join(work,"completed-ca.pem");await writeFile(derPath,der);execFileSync("openssl",["x509","-inform","DER","-in",derPath,"-out",intermediatePath]);
    const handshake=spawnSync("openssl",["s_client","-connect","cga.ct.gov:443","-servername","cga.ct.gov","-showcerts"],{input:"",encoding:"utf8",timeout:30000,maxBuffer:2*1024*1024});if(handshake.status!==0)throw new Error(`CT_STATUTE_TLS_HANDSHAKE:${handshake.stderr}`);const leaf=handshake.stdout.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/)?.[0];if(!leaf)throw new Error("CT_STATUTE_TLS_LEAF_MISSING");await writeFile(leafPath,`${leaf}\n`);execFileSync("openssl",["verify","-CAfile","/etc/ssl/certs/ca-certificates.crt","-untrusted",intermediatePath,leafPath]);
    await writeFile(caPath,Buffer.concat([await readFile("/etc/ssl/certs/ca-certificates.crt"),Buffer.from("\n"),await readFile(intermediatePath)]));acquired=[];
    for(const source of sources){const target=join(work,source.cacheName);execFileSync("curl",["-q","-fsSL","--cacert",caPath,"--retry","3","--connect-timeout","20","--max-time","120","-A","dsa-seats-source-lock/1.0","-o",target,source.url],{timeout:150000});acquired.push(verifySource(source,await readFile(target)));}
  }finally{await rm(work,{recursive:true,force:true});}
}
for(const [index,source] of sources.entries()){const target=resolve(source.output);await mkdir(dirname(target),{recursive:true});try{await writeFile(target,acquired[index],{flag:"wx",mode:0o644});}catch(error){if(error.code!=="EEXIST"||!(await readFile(target)).equals(acquired[index]))throw new Error(`CT_STATUTE_OUTPUT_CONFLICT:${source.id}`);}}
process.stdout.write(`${JSON.stringify({verifiedSources:4,retainedSources:4,tlsVerificationDisabled:false})}\n`);
