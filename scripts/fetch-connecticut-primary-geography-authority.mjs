import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const source = { url: "https://www2.census.gov/geo/tiger/TIGER2022/CD/tl_2022_09_cd118.zip", path: "data/source/tiger2022/tl_2022_09_cd118.zip", byteSize: 458752, sha256: "8d0a25a21e2536884c4f42603d167d13fc729be1944ae37499f3a0fd12b9b254" };
const expectedMembers = ["tl_2022_09_cd118.cpg","tl_2022_09_cd118.dbf","tl_2022_09_cd118.prj","tl_2022_09_cd118.shp","tl_2022_09_cd118.shp.ea.iso.xml","tl_2022_09_cd118.shp.iso.xml","tl_2022_09_cd118.shx"].sort();
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function members(bytes) { let e=-1; for(let o=bytes.length-22;o>=Math.max(0,bytes.length-65557);o--) if(bytes.readUInt32LE(o)===0x06054b50){e=o;break;} if(e<0) throw new Error("CT_PRIMARY_GEOGRAPHY_AUTHORITY_FORMAT_INVALID"); const count=bytes.readUInt16LE(e+10); let o=bytes.readUInt32LE(e+16); const names=[]; for(let i=0;i<count;i++){if(bytes.readUInt32LE(o)!==0x02014b50) throw new Error("CT_PRIMARY_GEOGRAPHY_AUTHORITY_FORMAT_INVALID"); const n=bytes.readUInt16LE(o+28),x=bytes.readUInt16LE(o+30),c=bytes.readUInt16LE(o+32); names.push(bytes.subarray(o+46,o+46+n).toString("utf8")); o+=46+n+x+c;} return names.sort(); }
const cache = process.env.DSA_SEATS_CT_PRIMARY_GEOGRAPHY_AUTHORITY_CACHE_FILE;
const bytes = cache ? await readFile(resolve(cache)) : Buffer.from(await (await fetch(source.url,{redirect:"follow",signal:AbortSignal.timeout(120000),headers:{"user-agent":"dsa-seats-source-lock/1.0"}})).arrayBuffer());
if(bytes.length!==source.byteSize||hash(bytes)!==source.sha256) throw new Error("CT_PRIMARY_GEOGRAPHY_AUTHORITY_SOURCE_DRIFT");
if(JSON.stringify(members(bytes))!==JSON.stringify(expectedMembers)) throw new Error("CT_PRIMARY_GEOGRAPHY_AUTHORITY_FORMAT_INVALID");
const output=resolve(source.path); await mkdir(dirname(output),{recursive:true}); try{await writeFile(output,bytes,{flag:"wx",mode:0o644});}catch(e){if(e.code!=="EEXIST"||!(await readFile(output)).equals(bytes)) throw new Error("CT_PRIMARY_GEOGRAPHY_AUTHORITY_OUTPUT_CONFLICT");}
process.stdout.write(`${JSON.stringify({output,byteSize:bytes.length,sha256:hash(bytes),members:expectedMembers})}\n`);
