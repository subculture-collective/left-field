/* eslint-disable @typescript-eslint/no-explicit-any -- FEC and frozen upstream JSON are validated at the package boundary. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  attachAndValidatePackageSha256,
  canonicalJson,
  officialBulkUrl,
  sha256Text,
  validateProposedPackage,
} from "../src/ingestion/fec/aipac-proposed-packages";

const CYCLES = [2022, 2024, 2026] as const;
const COMMITTEES = ["C00797670", "C00799031"] as const;
const API = "https://api.open.fec.gov/v1";
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const day = (value: unknown): string | null => typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
const num = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const text = (value: unknown): string | null => typeof value === "string" && value.length > 0 ? value : null;
const bytewise = (a: string, b: string) => Buffer.compare(Buffer.from(a), Buffer.from(b));
const sorted = <T>(values: T[], key: (value: T) => string) => values.sort((a, b) => bytewise(key(a), key(b)));
const fecDistrict = (district: string): string => district === "AL" ? "00" : district.padStart(2, "0");
const seatDistrict = (district: string): string => district === "00" || district === "0" ? "AL" : district.padStart(2, "0");

function arg(name: string, fallback?: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : fallback;
  if (!value) throw new Error(`MISSING_ARGUMENT:${name}`);
  return value;
}

async function credential(): Promise<string> {
  const env = await readFile(".env", "utf8");
  const line = env.split(/\r?\n/).find((row) => row.startsWith("FEC_API_CREDENTIAL="));
  const value = line?.slice("FEC_API_CREDENTIAL=".length).trim().replace(/^(['"])(.*)\1$/, "$2");
  if (!value || /[\u0000-\u0020\u007f]/.test(value)) throw new Error("FEC_API_CREDENTIAL_REQUIRED");
  return value;
}

function unzip(path: string, member: string): Buffer {
  return execFileSync("unzip", ["-p", path, member], { maxBuffer: 32 * 1024 * 1024 });
}

function rows(bytes: Buffer): string[][] {
  return bytes.toString("utf8").split(/\r?\n/).filter(Boolean).map((row) => row.split("|"));
}

async function sourceArtifact(root: string, file: string, kind: string, member: string | null, retrievedAt: string) {
  const path = resolve(root, file);
  const bytes = await readFile(path);
  const memberBytes = member ? unzip(path, member) : null;
  return {
    id: file.replace(/\.[^.]+$/, ""), kind,
    url: file.endsWith(".zip")
      ? officialBulkUrl(file)
      : `urn:dsa-seats:review-input:${file}`,
    byteSize: bytes.byteLength, sha256: sha(bytes), memberName: member,
    memberByteSize: memberBytes?.byteLength ?? null, memberSha256: memberBytes ? sha(memberBytes) : null,
    retrievedAt,
  };
}

type Receipt = {
  cycleYear: 2022 | 2024 | 2026; pass: 1 | 2; ordinal: number; requestSha256: string;
  bodySha256: string; byteSize: number; resultCount: number;
  cursorIn: { date: string; index: string } | null; cursorOut: { date: string; index: string } | null; terminal: boolean;
};

async function getPage(path: string, params: URLSearchParams, apiKey: string): Promise<{ body: Buffer; json: any; requestHash: string }> {
  const url = `${API}${path}?${params.toString()}`;
  for (let attempt = 0; attempt < 8; attempt++) {
    const response = await fetch(url, { headers: { "X-Api-Key": apiKey, Accept: "application/json" } });
    const body = Buffer.from(await response.arrayBuffer());
    if (response.ok) return { body, json: JSON.parse(body.toString("utf8")), requestHash: sha256Text("dsa-seats:fec-request:v1\0", url) };
    if (response.status !== 429 || attempt === 7) throw new Error(`FEC_API_HTTP_${response.status}:${path}`);
    const retryAfter = Number(response.headers.get("retry-after"));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 30_000) : Math.min(2_000 * 2 ** attempt, 30_000);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
  }
  throw new Error(`FEC_API_RETRY_EXHAUSTED:${path}`);
}

async function filingPass(committeeId: typeof COMMITTEES[number], cycle: typeof CYCLES[number], pass: 1 | 2, cutoff: string, apiKey: string) {
  const receipts: Receipt[] = []; const result: any[] = [];
  for (let page = 1; ; page++) {
    const params = new URLSearchParams({ committee_id: committeeId, cycle: String(cycle), per_page: "100", page: String(page), sort: "-receipt_date", max_receipt_date: cutoff });
    const response = await getPage("/filings/", params, apiKey);
    const found = Array.isArray(response.json.results) ? response.json.results : [];
    receipts.push({ cycleYear: cycle, pass, ordinal: page, requestSha256: response.requestHash, bodySha256: sha(response.body), byteSize: response.body.byteLength, resultCount: found.length, cursorIn: null, cursorOut: null, terminal: found.length === 0 });
    if (!found.length) break;
    result.push(...found);
  }
  return { receipts, result };
}

async function schedulePass(cycle: typeof CYCLES[number], pass: 1 | 2, cutoff: string, apiKey: string) {
  const receipts: Receipt[] = []; const result: any[] = []; let cursor: { date: string; index: string } | null = null;
  for (let ordinal = 1; ; ordinal++) {
    const params = new URLSearchParams({ committee_id: "C00799031", cycle: String(cycle), per_page: "100", sort: "-expenditure_date", max_filing_date: cutoff });
    if (cursor) { params.set("last_expenditure_date", cursor.date); params.set("last_index", cursor.index); }
    const response = await getPage("/schedules/schedule_e/", params, apiKey);
    const found = Array.isArray(response.json.results) ? response.json.results : [];
    const last = response.json.pagination?.last_indexes;
    const next = found.length && day(last?.last_expenditure_date) && text(last?.last_index)
      ? { date: day(last.last_expenditure_date)!, index: String(last.last_index) } : null;
    receipts.push({ cycleYear: cycle, pass, ordinal, requestSha256: response.requestHash, bodySha256: sha(response.body), byteSize: response.body.byteLength, resultCount: found.length, cursorIn: cursor, cursorOut: next, terminal: found.length === 0 });
    if (!found.length) break;
    result.push(...found); cursor = next;
    if (!cursor) throw new Error("FEC_SCHEDULE_E_CURSOR_MISSING");
  }
  return { receipts, result };
}

function filing(row: any, committeeId: typeof COMMITTEES[number], cycleYear: typeof CYCLES[number]) {
  const fileNumber = num(row.file_number); const receiptDate = day(row.receipt_date);
  if (!fileNumber || !receiptDate || !text(row.form_type)) throw new Error(`FEC_FILING_REQUIRED_FIELD_MISSING:${committeeId}:${cycleYear}:${String(row.file_number)}:${String(row.receipt_date)}:${String(row.form_type)}`);
  const value = {
    committeeId, cycleYear, fileNumber, previousFileNumber: num(row.previous_file_number),
    amendmentChain: (Array.isArray(row.amendment_chain) ? row.amendment_chain : []).filter((x: unknown) => Number.isInteger(x) && Number(x) > 0),
    amendmentIndicator: text(row.amendment_indicator), amendmentVersion: num(row.amendment_version), formType: row.form_type,
    reportType: text(row.report_type), receiptDate, coverageStartDate: day(row.coverage_start_date), coverageEndDate: day(row.coverage_end_date),
    meansFiled: text(row.means_filed),
  };
  return { ...value, identitySha256: sha256Text("dsa-seats:fec-filing:v1\0", canonicalJson(value)) };
}

function schedule(row: any, cycleYear: typeof CYCLES[number]) {
  const candidateId = text(row.candidate_id); const fileNumber = num(row.file_number); const filingDate = day(row.filing_date);
  const supportOppose = text(row.support_oppose_indicator); const amount = num(row.expenditure_amount);
  if (!fileNumber || !filingDate || !text(row.filing_form) || amount === null || !["S", "O"].includes(supportOppose ?? "")) throw new Error(`FEC_SCHEDULE_E_REQUIRED_FIELD_MISSING:${cycleYear}:${String(row.candidate_id)}:${String(row.file_number)}:${String(row.filing_date)}:${String(row.filing_form)}:${String(row.expenditure_amount)}:${String(row.support_oppose_indicator)}`);
  const hashId = (domain: string, value: unknown) => text(value) ? sha256Text(domain, String(value)) : null;
  const value = {
    cycleYear, committeeId: "C00799031" as const, candidateId, candidateOffice: text(row.candidate_office),
    candidateOfficeState: text(row.candidate_office_state), candidateOfficeDistrict: text(row.candidate_office_district), candidateParty: text(row.candidate_party),
    fileNumber, previousFileNumber: num(row.previous_file_number), amendmentIndicator: text(row.amendment_indicator), amendmentNumber: num(row.amendment_number),
    mostRecent: typeof row.most_recent === "boolean" ? row.most_recent : null, filingDate, filingForm: row.filing_form,
    electionType: text(row.election_type), supportOppose, amount, expenditureDate: day(row.expenditure_date), disseminationDate: day(row.dissemination_date),
    transactionIdSha256: hashId("dsa-seats:fec-transaction-id:v1\0", row.transaction_id)!,
    subIdSha256: hashId("dsa-seats:fec-sub-id:v1\0", row.sub_id)!,
    originalSubIdSha256: hashId("dsa-seats:fec-original-sub-id:v1\0", row.original_sub_id),
    linkIdSha256: hashId("dsa-seats:fec-link-id:v1\0", row.link_id), memoCode: row.memoed_subtotal ? "X" as const : null,
    memoedSubtotal: Boolean(row.memoed_subtotal), isNotice: typeof row.is_notice === "boolean" ? row.is_notice : null,
  };
  if (!value.transactionIdSha256 || !value.subIdSha256) throw new Error("FEC_SCHEDULE_E_ID_MISSING");
  return { ...value, recordIdentitySha256: sha256Text("dsa-seats:fec-schedule-e:v1\0", canonicalJson(value)) };
}

async function main() {
  const root = resolve(arg("--source-root", "/tmp/dsa-aipac-review-20260804"));
  const output = resolve(arg("--output-root", "data/metadata"));
  const cutoff = arg("--cutoff", "2026-08-04"); const generatedAt = arg("--generated-at", new Date().toISOString());
  const apiKey = await credential(); await mkdir(output, { recursive: true });

  const artifacts = [];
  for (const cycle of CYCLES) for (const prefix of ["cn", "cm", "ccl"] as const)
    artifacts.push(await sourceArtifact(root, `${prefix}${String(cycle).slice(2)}.zip`, `fec_${prefix}_archive`, `${prefix}.txt`, generatedAt));
  for (const file of ["dsa-aipac-targets.json", "dsa-seats-legislators-current.json"])
    artifacts.push(await sourceArtifact(root, file, "frozen_identity_snapshot", null, generatedAt));

  const targets = JSON.parse(await readFile(join(root, "dsa-aipac-targets.json"), "utf8"));
  const legislators = JSON.parse(await readFile(join(root, "dsa-seats-legislators-current.json"), "utf8"));
  const byBioguide = new Map<string, any>(legislators.map((person: any) => [person.id?.bioguide, person]));
  const masters = new Map<number, Map<string, string[]>>(); const committees = new Map<number, Set<string>>(); const links = new Map<number, string[][]>();
  for (const cycle of CYCLES) {
    masters.set(cycle, new Map(rows(unzip(join(root, `cn${String(cycle).slice(2)}.zip`), "cn.txt")).map((row) => [row[0]!, row])));
    committees.set(cycle, new Set(rows(unzip(join(root, `cm${String(cycle).slice(2)}.zip`), "cm.txt")).map((row) => row[0]!)));
    links.set(cycle, rows(unzip(join(root, `ccl${String(cycle).slice(2)}.zip`), "ccl.txt")));
  }

  const proposedDecisions: any[] = [];
  for (const target of targets) {
    const fecIds: string[] = byBioguide.get(target.bioguide_id)?.id?.fec ?? [];
    const matches = fecIds.flatMap((candidateId) => CYCLES.flatMap((cycle) => {
      const candidate = masters.get(cycle)!.get(candidateId);
      return candidate && candidate[2] === "DEM" && candidate[5] === "H" && candidate[4] === target.state_code && fecDistrict(candidate[6]) === fecDistrict(target.district_code)
        ? [{ candidateId, cycle, candidate }] : [];
    }));
    const ids = [...new Set(matches.map((match) => match.candidateId))];
    for (const candidateId of ids) {
      const applicable = matches.filter((match) => match.candidateId === candidateId);
      const committeeRows = applicable.map(({ cycle, candidate }) => {
        const linked = links.get(cycle)!.filter((row) => row[0] === candidateId && Number(row[2]) === cycle && ["P", "A"].includes(row[5] ?? "") && committees.get(cycle)!.has(row[3]!)).map((row) => row[3]!);
        const committeeIds = [...new Set(linked)].sort(bytewise); const principal = candidate[9];
        return { cycleYear: cycle, committeeIds, principalCommitteeCrosscheck: !principal ? "missing" : committeeIds.includes(principal) ? "matched" : "conflict" };
      });
      const status = ids.length === 1 && committeeRows.every((row) => row.committeeIds.length > 0 && row.principalCommitteeCrosscheck !== "conflict") ? "proposed" : "needs_review";
      proposedDecisions.push({
        decisionId: `incumbent:${target.seat_cycle_id}:${candidateId}`, status, candidateId, seatCycleId: target.seat_cycle_id,
        relationship: "incumbent", effectiveCycleYears: applicable.map((row) => row.cycle), office: "H", state: target.state_code,
        district: target.district_code, party: "DEM", authorizedCommitteeIdsByCycle: committeeRows,
        rationaleCodes: ["BIOGUIDE_FEC_EXACT", "CN_HOUSE_STATE_DISTRICT_PARTY_EXACT", "CCL_AUTHORIZED_COMMITTEE_EXACT"], inferred: false,
        evidenceRecordSha256s: applicable.map(({ candidate }) => sha256Text("dsa-seats:fec-cn-row:v1\0", candidate.join("|"))),
      });
    }
    if (!ids.length) {
      const candidateId = fecIds.find((id) => id.startsWith("H"));
      if (!candidateId) throw new Error(`INCUMBENT_FEC_ID_MISSING:${target.seat_cycle_id}`);
      proposedDecisions.push({
        decisionId: `incumbent:${target.seat_cycle_id}:${candidateId}`, status: "needs_review", candidateId,
        seatCycleId: target.seat_cycle_id, relationship: "incumbent", effectiveCycleYears: [2026], office: "H",
        state: target.state_code, district: target.district_code, party: "DEM",
        authorizedCommitteeIdsByCycle: [{ cycleYear: 2026, committeeIds: [], principalCommitteeCrosscheck: "conflict" }],
        rationaleCodes: ["BIOGUIDE_FEC_SOURCE_CONFLICT", "NO_CN_HOUSE_STATE_DISTRICT_PARTY_EXACT_MATCH"], inferred: false,
        evidenceRecordSha256s: [sha256Text("dsa-seats:legislator-fec-id:v1\0", `${target.bioguide_id}:${candidateId}`)],
      });
    }
  }

  const filingLedgers: any[] = []; const allSchedule: any[] = [];
  for (const committeeId of COMMITTEES) {
    const sourcePages: Receipt[] = []; const filings: any[] = [];
    for (const cycle of CYCLES) {
      const one = await filingPass(committeeId, cycle, 1, cutoff, apiKey); const two = await filingPass(committeeId, cycle, 2, cutoff, apiKey);
      const allowed = committeeId === "C00797670" ? new Set(["F3X"]) : new Set(["F3X", "F24", "F5"]);
      const retain = (row: any) => allowed.has(String(row.form_type ?? "").replace(/A$/, "")) && Number.isInteger(row.file_number) && row.file_number > 0;
      const oneRows = one.result.filter(retain).map((row) => filing(row, committeeId, cycle));
      const twoRows = two.result.filter(retain).map((row) => filing(row, committeeId, cycle));
      if (canonicalJson(oneRows) !== canonicalJson(twoRows)) throw new Error(`FEC_FILING_PASS_MISMATCH:${committeeId}:${cycle}`);
      sourcePages.push(...one.receipts, ...two.receipts); filings.push(...oneRows);
    }
    sorted(filings, (row) => `${row.cycleYear}:${String(row.fileNumber).padStart(10, "0")}`);
    filingLedgers.push({ committeeId, endpoint: `${API}/filings/`, completePasses: 2, terminalEmptyPages: true,
      passDigestSha256: sha256Text("dsa-seats:fec-filings-pass:v1\0", canonicalJson(filings)), sourcePages, filings });
  }
  const schedulePages: Receipt[] = [];
  for (const cycle of CYCLES) {
    const one = await schedulePass(cycle, 1, cutoff, apiKey); const two = await schedulePass(cycle, 2, cutoff, apiKey);
    const oneRows = one.result.map((row) => schedule(row, cycle)); const twoRows = two.result.map((row) => schedule(row, cycle));
    if (canonicalJson(oneRows) !== canonicalJson(twoRows)) throw new Error(`FEC_SCHEDULE_E_PASS_MISMATCH:${cycle}`);
    schedulePages.push(...one.receipts, ...two.receipts); allSchedule.push(...oneRows);
  }
  sorted(allSchedule, (row) => `${row.cycleYear}:${row.recordIdentitySha256}`);

  const targetByDistrict = new Map(targets.map((target: any) => [`${target.state_code}:${seatDistrict(target.district_code)}`, target]));
  const incumbentIds = new Set(proposedDecisions.map((row) => row.candidateId));
  for (const row of allSchedule) {
    const district = row.candidateOfficeDistrict ? seatDistrict(row.candidateOfficeDistrict) : null; const target = targetByDistrict.get(`${row.candidateOfficeState}:${district}`) as any;
    if (!target || !row.candidateId || row.candidateOffice !== "H" || row.candidateParty !== "DEM" || incumbentIds.has(row.candidateId) || !String(row.electionType ?? "").startsWith("P")) continue;
    const key = `challenger:${target.seat_cycle_id}:${row.candidateId}`;
    if (proposedDecisions.some((decision) => decision.decisionId === key)) continue;
    proposedDecisions.push({ decisionId: key, status: "proposed", candidateId: row.candidateId, seatCycleId: target.seat_cycle_id,
      relationship: "democratic_primary_challenger", effectiveCycleYears: [row.cycleYear], office: "H", state: row.candidateOfficeState,
      district, party: "DEM", authorizedCommitteeIdsByCycle: [{ cycleYear: row.cycleYear, committeeIds: [], principalCommitteeCrosscheck: "missing" }],
      rationaleCodes: ["UDP_SCHEDULE_E_TARGET_EXACT", "DEMOCRATIC_HOUSE_PRIMARY_INFERRED"], inferred: true, evidenceRecordSha256s: [row.recordIdentitySha256] });
  }
  sorted(proposedDecisions, (row) => row.decisionId);

  const mapping = attachAndValidatePackageSha256({ schema: "aipac-candidate-seat-mappings-proposal-v1", version: 1,
    releaseId: targets[0].release_id, sourceCutoff: cutoff, generatedAt, sourceArtifacts: artifacts,
    targetUniverse: { expected: 212, observed: targets.length, allHaveFecCandidateId: true }, proposedDecisions,
    review: { status: "proposed", reviewer: null, reviewedAt: null } });
  const evidence = attachAndValidatePackageSha256({ schema: "aipac-evidence-closure-proposal-v1", version: 1, sourceCutoff: cutoff,
    generatedAt, cycles: CYCLES, filingLedgers, scheduleE: { committeeId: "C00799031", endpoint: `${API}/schedules/schedule_e/`,
      completePasses: 2, terminalEmptyPages: true, passDigestSha256: sha256Text("dsa-seats:fec-schedule-e-pass:v1\0", canonicalJson(allSchedule)), sourcePages: schedulePages, records: allSchedule },
    review: { status: "proposed", reviewer: null, reviewedAt: null } });

  const classFiles = [
    ["aipac-politics.html", "https://aipac.org/politics", "aipac_primary_statement", "United Democracy Project"],
    ["fec-aipac-pac.html", "https://www.fec.gov/data/committee/C00797670/", "fec_committee_record", "C00797670"],
    ["fec-udp.html", "https://www.fec.gov/data/committee/C00799031/", "fec_committee_record", "C00799031"],
  ] as const;
  const sources = await Promise.all(classFiles.map(async ([file, url, sourceKind, marker]) => {
    const bytes = await readFile(join(root, file)); const body = bytes.toString("utf8");
    if (!body.toLowerCase().includes(marker.toLowerCase())) throw new Error(`CLASSIFICATION_MARKER_MISSING:${file}`);
    return { snapshotId: file.replace(/\.[^.]+$/, ""), url, byteSize: bytes.byteLength, artifactSha256: sha(bytes), retrievedAt: generatedAt,
      sourceKind, retainedExcerptSha256: sha256Text("dsa-seats:classification-marker:v1\0", marker) };
  }));
  const classification = attachAndValidatePackageSha256({ schema: "org-classification-aipac-network-proposal-v1", version: 1, generatedAt,
    classification: { subjectCommitteeId: "C00799031", relationship: "aipac_backed_super_pac", networkRootCommitteeId: "C00797670",
      confidence: "primary_source_explicit", status: "proposed" }, sources, review: { status: "proposed", reviewer: null, reviewedAt: null } });

  for (const value of [mapping, evidence, classification]) validateProposedPackage(value);
  const outputs = [
    ["aipac-candidate-seat-mappings-proposal-v1.json", mapping],
    ["aipac-evidence-closure-proposal-v1.json", evidence],
    ["org-classification-aipac-network-proposal-v1.json", classification],
  ] as const;
  for (const [file, value] of outputs) await writeFile(join(output, file), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o644 });
  process.stdout.write(JSON.stringify({ output, generatedAt, mappingDecisions: proposedDecisions.length,
    mappingNeedsReview: proposedDecisions.filter((row) => row.status === "needs_review").length,
    filingCounts: filingLedgers.map((row) => ({ committeeId: row.committeeId, count: row.filings.length })), scheduleECount: allSchedule.length }, null, 2) + "\n");
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "GENERATION_FAILED"}\n`); process.exitCode = 1; });
