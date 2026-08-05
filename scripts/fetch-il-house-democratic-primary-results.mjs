import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const baseUrl = "https://www.elections.il.gov";
const cycles = [
  {
    year: 2022,
    electionId: "61",
    listingUrl: `${baseUrl}/electionoperations/ElectionVoteTotals.aspx?ID=63aIZoIunYs%3D&OfficeType=LpWf6lpbWOfBN3kEuxRi3A%3D%3D`,
    listingOutput: "data/source/elections/primary-results/illinois/2022/official-house-listing.html",
  },
  {
    year: 2024,
    electionId: "65",
    listingUrl: `${baseUrl}/electionoperations/ElectionVoteTotals.aspx?ID=rfZ%2BuidMSDY%3D&OfficeType=LpWf6lpbWOfBN3kEuxRi3A%3D%3D`,
    listingOutput: "data/source/elections/primary-results/illinois/2024/official-house-listing.html",
  },
];
const expectedHeader = '"JurisdictionID","JurisContainerID","JurisName","EISCandidateID","CandidateName","EISContestID","ContestName","PrecinctName","Registration","EISPartyID","PartyName","VoteCount"';
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sourceLock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8"));
const sourceById = new Map(sourceLock.entries.map((entry) => [entry.id, entry]));
function expectedSource(id, output, url) {
  const entry = sourceById.get(id);
  if (!entry || entry.retainedStatus !== "retained" || entry.kind !== "source" || entry.retainedPath !== output || entry.url !== url) throw new Error(`IL_PRIMARY_SOURCE_LOCK_ENTRY_INVALID:${id}`);
  return entry;
}

async function fetchExact(url, maximumBytes) {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`IL_PRIMARY_FETCH_FAILED:${response.status}:${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > maximumBytes) throw new Error(`IL_PRIMARY_RESPONSE_SIZE_INVALID:${bytes.byteLength}:${url}`);
  return bytes;
}

async function writeExact(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  try { await writeFile(path, bytes, { mode: 0o644, flag: "wx" }); }
  catch (error) {
    if (error.code !== "EEXIST") throw error;
    if (!(await readFile(path)).equals(bytes)) throw new Error(`IL_PRIMARY_OUTPUT_CONFLICT:${path}`);
  }
}

function houseLinks(html, cycle) {
  const pattern = new RegExp(`href="([\\\\/]Downloads[\\\\/]ElectionOperations[\\\\/]ElectionResults[\\\\/]ByOffice[\\\\/]${cycle.electionId}[\\\\/]${cycle.electionId}-(\\d+)-([^"\\r\\n]+)-${cycle.year}GP\\.csv)"`, "g");
  const links = [];
  for (const match of html.matchAll(pattern)) {
    const contestId = Number(match[2]);
    const district = (contestId - 240) / 10;
    if (!Number.isInteger(district) || district < 1 || district > 17) continue;
    if (!new RegExp(`^${district}(?:ST|ND|RD|TH) CONGRESS$`).test(match[3])) throw new Error(`IL_PRIMARY_CONTEST_NAME_INVALID:${cycle.year}:${match[3]}`);
    links.push({ district, url: new URL(match[1].replaceAll("\\", "/"), baseUrl).href });
  }
  links.sort((left, right) => left.district - right.district);
  if (links.length !== 17 || new Set(links.map(({ district }) => district)).size !== 17 || links.some(({ district }, index) => district !== index + 1)) throw new Error(`IL_PRIMARY_LISTING_COVERAGE_INVALID:${cycle.year}`);
  return links;
}

for (const cycle of cycles) {
  const listingPath = resolve(cycle.listingOutput);
  const expectedListing = expectedSource(`il-${cycle.year}-house-primary-listing`, cycle.listingOutput, cycle.listingUrl);
  const listingBytes = await readFile(listingPath);
  if (listingBytes.byteLength !== expectedListing.byteSize || sha(listingBytes) !== expectedListing.sha256) throw new Error(`IL_PRIMARY_RETAINED_LISTING_MISMATCH:${cycle.year}`);
  const retainedLinks = houseLinks(new TextDecoder("utf-8", { fatal: true }).decode(listingBytes), cycle);
  const liveListingBytes = await fetchExact(cycle.listingUrl, 1_000_000);
  const links = houseLinks(new TextDecoder("utf-8", { fatal: true }).decode(liveListingBytes), cycle);
  if (JSON.stringify(links) !== JSON.stringify(retainedLinks)) throw new Error(`IL_PRIMARY_LISTING_LINK_DRIFT:${cycle.year}`);
  process.stdout.write(`${JSON.stringify({ kind: "listing", cycleYear: cycle.year, url: cycle.listingUrl, output: listingPath, byteSize: listingBytes.byteLength, sha256: sha(listingBytes), liveListingLinkSetVerified: true })}\n`);
  for (const link of links) {
    const resultBytes = await fetchExact(link.url, 10_000_000);
    const header = resultBytes.subarray(0, expectedHeader.length).toString("utf8");
    if (header !== expectedHeader) throw new Error(`IL_PRIMARY_CSV_HEADER_INVALID:${cycle.year}:${link.district}`);
    const output = resolve(`data/source/elections/primary-results/illinois/${cycle.year}/il-${String(link.district).padStart(2, "0")}.csv`);
    const retainedPath = `data/source/elections/primary-results/illinois/${cycle.year}/il-${String(link.district).padStart(2, "0")}.csv`;
    const expected = expectedSource(`il-${cycle.year}-house-primary-district-${String(link.district).padStart(2, "0")}`, retainedPath, link.url);
    if (resultBytes.byteLength !== expected.byteSize || sha(resultBytes) !== expected.sha256) throw new Error(`IL_PRIMARY_RESULT_DRIFT:${cycle.year}:${link.district}`);
    await writeExact(output, resultBytes);
    process.stdout.write(`${JSON.stringify({ kind: "contest_result", cycleYear: cycle.year, district: link.district, url: link.url, output, byteSize: resultBytes.byteLength, sha256: sha(resultBytes) })}\n`);
  }
}
