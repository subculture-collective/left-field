import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const endpoint = "https://electionhistory.ct.gov/api/graphql_pr";
const suggestionQuery = "query GetEventSuggestions($suggestionFilters: SearchFilters!) { searchSuggestions(filters:$suggestionFilters) { events { id name group count } } }";
const resultsQuery = "query GetLatestResults($searchFilters: SearchFilters!, $pagination: Pagination!) { search(filters:$searchFilters, pagination:$pagination) { results { id name candidates { displayName nVotes pctCandidateVotes candidate { pseudocandidate } isWinner } eventTypeDisplayName office { name } event { startDate } division { displayName } } } }";
const filters = (global) => ({ global, ballotQuestions: { text: "", types: [], number: "", divisions: [] }, contests: { candidates: [], divisions: [], offices: [] }, specialElectionsOnly: false, voterStats: false, stages: [] });
const sources = [
  { id: "ct-2022-primary-event-discovery-response", output: "data/source/elections/primary-results/connecticut/2022/event-discovery-response.json", byteSize: 474, sha256: "d58b5da59d3e55ee9b13034bc75ae19c4907c39a080fe7fdafa97a77b7564dfa", request: { operationName: "GetEventSuggestions", variables: { suggestionFilters: filters({ years: { from: 2022, to: 2022 } }) }, query: suggestionQuery } },
  { id: "ct-2022-primary-event-598-results-response", output: "data/source/elections/primary-results/connecticut/2022/event-598-results-response.json", byteSize: 13201, sha256: "a7f887fe1de2379cb6a80fdd6437b8524eadec152dde8e883d586f64bc73430e", request: { operationName: "GetLatestResults", variables: { searchFilters: filters({ events: [598] }), pagination: { page: 1, size: 100 } }, query: resultsQuery } },
  { id: "ct-2024-primary-event-discovery-response", output: "data/source/elections/primary-results/connecticut/2024/event-discovery-response.json", byteSize: 381, sha256: "27cdef87cfd86d8049097a9b0bb2a86ab377477c002b2d7c69c0a9997575e618", request: { operationName: "GetEventSuggestions", variables: { suggestionFilters: filters({ years: { from: 2024, to: 2024 } }) }, query: suggestionQuery } },
  { id: "ct-2024-primary-event-583-results-response", output: "data/source/elections/primary-results/connecticut/2024/event-583-results-response.json", byteSize: 17492, sha256: "f87bef38061705dd986c9ffad05501f0b70858f3481796c3fa7ecc99b8101982", request: { operationName: "GetLatestResults", variables: { searchFilters: filters({ events: [583] }), pagination: { page: 1, size: 100 } }, query: resultsQuery } },
];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const source of sources) {
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", "X-Elstats-Tenant": "ct" }, body: JSON.stringify(source.request), signal: AbortSignal.timeout(30_000) }); if (!response.ok) throw new Error(`CT_PRIMARY_FETCH_FAILED:${source.id}:${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer()); if (bytes.byteLength !== source.byteSize || sha(bytes) !== source.sha256) throw new Error(`CT_PRIMARY_SOURCE_DRIFT:${source.id}`); const parsed = JSON.parse(bytes.toString("utf8")); if (parsed.errors || !parsed.data) throw new Error(`CT_PRIMARY_GRAPHQL_ERROR:${source.id}`);
  const output = resolve(source.output); await mkdir(dirname(output), { recursive: true }); try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if (error.code !== "EEXIST") throw error; if (!(await readFile(output)).equals(bytes)) throw new Error(`CT_PRIMARY_OUTPUT_CONFLICT:${source.id}`); }
  process.stdout.write(`${JSON.stringify({ id: source.id, url: endpoint, output, byteSize: bytes.byteLength, sha256: sha(bytes), requestSha256: sha(Buffer.from(JSON.stringify(source.request))) })}\n`);
}
