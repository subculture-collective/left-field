import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sources = [
  [2022, "07", "01001800007Crossover%20Democratic%20Representative%20in%20Congress%207th%20Congressional%20District%20Recap.csv", 192229, "ab2bde5c3815b602bc821c6bd9c18441ac713cc0bfe47580d7bf5186037b701e"],
  [2022, "08", "01301800008Kings%20Democratic%20Representative%20in%20Congress%208th%20Congressional%20District%20Recap.csv", 170372, "2a1102e8ade7c17f3b55f90ff93e6ee0a787110bd02ea682903ffe15fc4d3d74"],
  [2022, "10", "01001800010Crossover%20Democratic%20Representative%20in%20Congress%2010th%20Congressional%20District%20Recap.csv", 105457, "60f1ddce68bbeee9d206e4979e97b5907d9073effefdb8c6b2f8b6f3ccd48352"],
  [2022, "11", "01001800011Crossover%20Democratic%20Representative%20in%20Congress%2011th%20Congressional%20District%20Recap.csv", 101668, "7f228a7627950ef12c2f9c35f19ba67043e09f165c58d590bb847d2ea21c7aec"],
  [2022, "12", "01101800012New%20York%20Democratic%20Representative%20in%20Congress%2012th%20Congressional%20District%20Recap.csv", 149954, "1e41b2682b87b124b9ea12ef156a53869992c846eca15cf3811d6a84ff531cb9"],
  [2022, "13", "01001800013Crossover%20Democratic%20Representative%20in%20Congress%2013th%20Congressional%20District%20Recap.csv", 318918, "a0cdda6716bb7579ae0f88bef569051cda850797bca4c9bc68c61fbf5580b61c"],
  [2024, "10", "01001900010Crossover%20Democratic%20Representative%20in%20Congress%2010th%20Congressional%20District%20Recap.csv", 211521, "52b9aa19e0b800822a584430f368dd9f01b18b6e38180a8009be4524f3d7f3b7"],
  [2024, "14", "01001900014Crossover%20Democratic%20Representative%20in%20Congress%2014th%20Congressional%20District%20Recap.csv", 69147, "0b3ad7e36d7387151a339e7b9402c5ad42912aadec7600561b2b6803608a25d6"],
].map(([year, district, file, byteSize, sha256]) => ({ year, district, file, byteSize, sha256, id: `nyc-${year}-house-democratic-primary-cd-${district}-certified-recap`, url: `https://www.vote.nyc/sites/default/files/pdf/election_results/${year}/${year === 2022 ? "20220823Primary%20Election" : "20240625Primary%20Election"}/${file}`, output: `data/source/elections/primary-results/new-york-city/${year}/nyc-cd-${district}-certified-recap.csv` }));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const source of sources) {
  const response = await fetch(source.url, { redirect: "follow", signal: AbortSignal.timeout(30_000) }); if (!response.ok) throw new Error(`NYC_PRIMARY_FETCH_FAILED:${source.id}:${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer()); if (bytes.byteLength !== source.byteSize || sha(bytes) !== source.sha256 || !bytes.subarray(0, 3).toString("ascii").startsWith(",,")) throw new Error(`NYC_PRIMARY_SOURCE_DRIFT:${source.id}`);
  const output = resolve(source.output); await mkdir(dirname(output), { recursive: true }); try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if (error.code !== "EEXIST") throw error; if (!(await readFile(output)).equals(bytes)) throw new Error(`NYC_PRIMARY_OUTPUT_CONFLICT:${source.id}`); }
  process.stdout.write(`${JSON.stringify({ ...source, output })}\n`);
}
