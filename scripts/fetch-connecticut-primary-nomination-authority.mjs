import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const base = "https://portal.ct.gov";
const sources = [
  ["2022-index", "/sots/election-services/certificate-of-endorsement/2022-certificate-of-endorsements?archived=true", "2022.html", 124616, "288681658f136c1d62c2720e1d8c37a5c1a9daab307b2f0c29820c71659c5f83", "data/source/elections/primary-results/connecticut/authority/2022-endorsement-certificate-index.html"],
  ["2024-index", "/sots/election-services/certificate-of-endorsement/2024-certificates-of-endorsement", "2024.html", 179618, "b61be244d22a3f2e2582f270ec7b5682a301a4d0bc0a6c27f40df79a092b55a9", "data/source/elections/primary-results/connecticut/authority/2024-endorsement-certificate-index.html"],
  ["2024-list-index", "/sots/election-services/list_of_candidates/2024-august-primary", "list2024.html", 27388, "5b40484e94f603bd6403bf116e03673b493681e09c67cddc267727f30d676db6", "data/source/elections/primary-results/connecticut/authority/2024-democratic-primary-candidate-list-index.html"],
  ["2022-cd1", "/-/media/sots/electionservices/certificates_of_party_endorsement/2022/cd-1-dem-and-rep.pdf?rev=28016969944d47d89e603b3e6e38fb29&hash=02B40F915E6BD608057D1CD6EC361EE4", "source-1.pdf", 748658, "69a4fed16807683dc08b2513b8328d46c060cbb3ad75542cd1e02a1bb1606bba"],
  ["2022-cd2", "/-/media/sots/electionservices/certificates_of_party_endorsement/2022/cd-2-dem-and-rep.pdf?rev=3be0520a3c634ce8bd14927d5b00920c&hash=6E6AADD54B7281A9E31D1C7F8459449B", "source-2.pdf", 541001, "560c3d15bac6b0c6890238f8b9cc8137719d301b8b78bbc5c340ac50f672226c"],
  ["2022-cd3", "/-/media/sots/electionservices/certificates_of_party_endorsement/2022/cd-3-dem-and-rep.pdf?rev=e01383e8b5274192be0bab85b911ce59&hash=5FB2912568C5DAF275433D7CCA72F3AC", "source-3.pdf", 559171, "005da7e6a63eb413711062846eaf338c3faf4d86d595fc1b5d5eaf259c843d14"],
  ["2022-cd4", "/-/media/sots/electionservices/certificates_of_party_endorsement/2022/cd-4-dem-and-rep.pdf?rev=fe310bf99b994511a3b4c742a18bf339&hash=6E594B824EA276D8FF266B2FA4020186", "source-4.pdf", 526318, "90e01d398d7d0f27d5fe963c1f6278df93d7a274c994214aaa21e7371c3cafa4"],
  ["2022-cd5", "/-/media/sots/electionservices/certificates_of_party_endorsement/2022/cd-5-dem-and-rep.pdf?rev=1ea8a316ccd7441db5879c857bfc1cbc&hash=146D83E8D165C17AEA9EB8887A897DE6", "source-5.pdf", 525956, "0775045c6b35ba543a59dd3bb0fc15562022a5283308c47045bbd7b8abcc3c1c"],
  ["2024-cd1", "/-/media/sots/electionservices/certificates_of_party_endorsement/2024/congressional/1st-congressional-dem--rep.pdf?rev=76cc0864e6fb4281b3c9848d5e37d932&hash=5BAF2061BEC7A92EC240B04FE45FFF3B", "source-6.pdf", 562334, "52f055601f40d806601a2b7147e3e13b8463ba0d98cfd49640e63b9b3c6920dd"],
  ["2024-cd2", "/-/media/sots/electionservices/certificates_of_party_endorsement/2024/congressional/2nd-congressional-dem--rep.pdf?rev=0a5a14f3f280499fb79f1bfd3a093faa&hash=90C4C5956AD09818E756D24844141184", "source-7.pdf", 597862, "82129cf39e03491a25e1f596c4f4f853dab4ee53919acbe1cff9bfc55fd9ffe8"],
  ["2024-cd3", "/-/media/sots/electionservices/certificates_of_party_endorsement/2024/congressional/3rd-congressional-dem--rep.pdf?rev=554b41992985429d9d3dfafe327a94a1&hash=291BF0C289C9F528C7C9E9F1E4B42C3A", "source-8.pdf", 340583, "462dfb58e138344e8b63e19a5d429a7482b163125cdc1cbb67c9c326c7e29925"],
  ["2024-cd4", "/-/media/sots/electionservices/certificates_of_party_endorsement/2024/congressional/4th-congressional-dem-rep--15.pdf?rev=65b2a2da39924577a2802020c5890aa1&hash=4F3647958E1D1BB8114B921790916011", "source-9.pdf", 1137144, "05891c75305e42f8af23c4bbd2f8a863c318dd642b775af6d9a479a3c911a5a4"],
  ["2024-cd5", "/-/media/sots/electionservices/certificates_of_party_endorsement/2024/congressional/5th-congressional-dem--rep.pdf?rev=8abbcd4d8d9843bf8ab812527cea7040&hash=C909DC0213D7FD5C47DDCBBB91DCD302", "source-10.pdf", 321207, "ef4aca7f4c208b6402664b5784a0c177527fcf4ad637d966ec1d5af669232f52"],
  ["2024-dem-list", "/-/media/sots/electionservices/lists/list_of_candidates/2024/august_primary/list-of-nominees_august_13_2024_democratic_primary.pdf?rev=c89bc3e838fa4720b76c65dc4a12c298&hash=32BBEF0D79E1099667D2333D3877B681", "source-11.pdf", 370058, "a9bfade28251dad077e393180600dac64473d047e8b1f0fc72e32f0d89cbbbe6"],
];
const cache = process.env.DSA_SEATS_CT_NOMINATION_AUTHORITY_CACHE_DIR;
const hash = (b) => createHash("sha256").update(b).digest("hex");
if (process.env.DSA_SEATS_CT_NOMINATION_AUTHORITY_DESCRIBE === "1") {
  process.stdout.write(`${JSON.stringify({ verifiedSources: sources.length, retainedSources: sources.filter((s) => s[5]).length, sources: sources.map(([id,,,size,sha,output]) => ({ id, byteSize: size, sha256: sha, retained: Boolean(output) })) })}\n`);
  process.exit(0);
}
for (const [id, path, cacheName, size, sha, output] of sources) {
  const bytes = cache ? await readFile(resolve(cache, cacheName)) : Buffer.from(await (await fetch(`${base}${path}`, { signal: AbortSignal.timeout(120000), headers: { "user-agent": "dsa-seats-source-lock/1.0" } })).arrayBuffer());
  if (bytes.length !== size || hash(bytes) !== sha) throw new Error(`CT_NOMINATION_AUTHORITY_SOURCE_DRIFT:${id}`);
  if (output) { const target = resolve(output); await mkdir(dirname(target), { recursive: true }); try { await writeFile(target, bytes, { flag: "wx" }); } catch (e) { if (e.code !== "EEXIST" || !(await readFile(target)).equals(bytes)) throw new Error(`CT_NOMINATION_AUTHORITY_OUTPUT_CONFLICT:${id}`); } }
}
process.stdout.write(`${JSON.stringify({ verifiedSources: sources.length, retainedSources: sources.filter((s) => s[5]).length })}\n`);
