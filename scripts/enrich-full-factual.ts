import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { PoolClient } from "pg";

import { closeDb, getNationwideFinalizerPool } from "@/db/client";
import {
  expectedContentChecksum,
  validateNationwideCandidateReleaseWithClient,
} from "@/db/catalog-release";
import { loadNationwideManifestForFinalization } from "@/db/manifest";
import { computeCanonicalDataChecksum, validateReleaseManifest } from "@/domain/validate-manifest";

type Json = Record<string, unknown>;
type Legislator = {
  id: { bioguide: string; fec?: string[] };
  bio: { birthday: string };
  name: { official_full?: string; first: string; last: string };
};
type Committee = {
  type: string;
  name: string;
  thomas_id: string;
  subcommittees?: Array<{ name: string; thomas_id: string }>;
};
type Assignment = { bioguide: string; title?: string; party?: string; rank?: number };

export type FullFactualArguments = {
  release: string;
  sourceRelease: string;
  cutoff: string;
  retrievedAt: string;
  legislators: string;
  committees: string;
  assignments: string;
  elections: string;
  fecSummaries: string[];
  independentExpenditures: string;
};

const usage = "Require --release, --source-release, --cutoff, --retrieved-at, --legislators, --committees, --assignments, --elections, one or more --fec-summary, and --independent-expenditures";
const releasePattern = /^rel_[A-Za-z0-9_-]{1,128}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function parseFullFactualArguments(argv: readonly string[]): FullFactualArguments {
  const one = new Map<string, string>();
  const fecSummaries: string[] = [];
  const allowed = new Set(["--release", "--source-release", "--cutoff", "--retrieved-at", "--legislators", "--committees", "--assignments", "--elections", "--fec-summary", "--independent-expenditures"]);
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index], value = argv[index + 1];
    if (!key || !value || !allowed.has(key) || value.startsWith("--")) throw new Error(usage);
    if (key === "--fec-summary") fecSummaries.push(value);
    else if (one.has(key)) throw new Error(usage);
    else one.set(key, value);
  }
  const release = one.get("--release"), sourceRelease = one.get("--source-release"), cutoff = one.get("--cutoff"), retrievedAt = one.get("--retrieved-at");
  const legislators = one.get("--legislators"), committees = one.get("--committees"), assignments = one.get("--assignments"), elections = one.get("--elections"), independentExpenditures = one.get("--independent-expenditures");
  if (!release || !sourceRelease || release === sourceRelease || !releasePattern.test(release) || !releasePattern.test(sourceRelease) || !cutoff || !datePattern.test(cutoff) || !retrievedAt || Number.isNaN(Date.parse(retrievedAt)) || retrievedAt.slice(0, 10) !== cutoff || !legislators || !committees || !assignments || !elections || !independentExpenditures || fecSummaries.length === 0) throw new Error(usage);
  return { release, sourceRelease, cutoff, retrievedAt: new Date(retrievedAt).toISOString(), legislators, committees, assignments, elections, fecSummaries, independentExpenditures };
}

const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const safeId = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const number = (value: string | undefined): number | null => {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value.replace(/,/g, "").replace(/%$/, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

/** RFC 4180 parser used for official FEC and publisher spreadsheets. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let value = ""; let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') { value += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(value); value = ""; }
    else if (char === "\n") { row.push(value.replace(/\r$/, "")); rows.push(row); row = []; value = ""; }
    else value += char;
  }
  if (quoted) throw new Error("CSV_UNTERMINATED_QUOTE");
  if (value.length || row.length) { row.push(value.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((candidate) => candidate.some((cell) => cell.length > 0));
}

const records = (input: string): Json[] => {
  const rows = parseCsv(input); const header = rows.shift();
  if (!header) throw new Error("CSV_HEADER_MISSING");
  return rows.map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ""])));
};

export type PresidentialDistrict = { state: string; district: string; harris: number; trump: number; total: number };
export function parsePresidentialDistricts(input: string): PresidentialDistrict[] {
  const rows = parseCsv(input);
  const headerIndex = rows.findIndex((row) => row[0] === "District" && row.includes("2024"));
  if (headerIndex < 0) throw new Error("ELECTION_HEADER_MISSING");
  const data = rows.slice(headerIndex + 2).filter((row) => /^[A-Z]{2}-(?:AL|\d{2})$/.test(row[0] ?? ""));
  const result = data.map((row) => {
    const [state, district] = row[0]!.split("-") as [string, string];
    const harris = number(row[3]), trump = number(row[4]), total = number(row[5]);
    if (harris === null || trump === null || total === null || harris + trump > total) throw new Error(`ELECTION_ROW_INVALID:${row[0]}`);
    return { state, district, harris, trump, total };
  });
  if (result.length !== 435 || new Set(result.map((row) => `${row.state}-${row.district}`)).size !== 435) throw new Error("ELECTION_DISTRICT_CLOSURE_INVALID");
  return result;
}

type SourceFile = { id: string; sourceId: string; sourceName: string; authority: string; homepage: string; url: string; license: string; parser: string; bytes: Buffer };
async function insertSource(client: PoolClient, release: string, retrievedAt: string, source: SourceFile): Promise<void> {
  await client.query("INSERT INTO sources(release_id,id,name,authority,homepage_url) VALUES($1,$2,$3,$4,$5)", [release, source.sourceId, source.sourceName, source.authority, source.homepage]);
  await client.query("INSERT INTO source_snapshots(release_id,id,source_id,source_url,published_at,retrieved_at,checksum_sha256,parser_version,license,usage_status) VALUES($1,$2,$3,$4,NULL,$5,$6,$7,$8,'approved')", [release, source.id, source.sourceId, source.url, retrievedAt, sha256(source.bytes), source.parser, source.license]);
}

const scopeKey = (kind: string, extras: Record<string, unknown> = {}): string => JSON.stringify({ kind, jurisdictionCode: null, seatCycleId: null, variable: null, surveyPeriod: null, electionYear: null, fundingKind: null, ...extras });

async function replaceCoverage(client: PoolClient, release: string, domain: string, key: string, values: { status: string; expected: number; observed: number; snapshotId: string; reason?: string }): Promise<void> {
  await client.query("DELETE FROM coverage_missing_reasons WHERE release_id=$1 AND domain=$2 AND scope_key=$3", [release, domain, key]);
  await client.query("DELETE FROM coverage_input_snapshots WHERE release_id=$1 AND domain=$2 AND scope_key=$3", [release, domain, key]);
  await client.query("UPDATE coverage_records SET status=$4,expected_count=$5,observed_count=$6,quarantined_count=0,incompatible_count=0 WHERE release_id=$1 AND domain=$2 AND scope_key=$3", [release, domain, key, values.status, values.expected, values.observed]);
  if (values.reason) await client.query("INSERT INTO coverage_missing_reasons(release_id,domain,scope_key,reason,count) VALUES($1,$2,$3,$4,$5)", [release, domain, key, values.reason, values.expected - values.observed || 1]);
  await client.query("INSERT INTO coverage_input_snapshots(release_id,domain,scope_key,snapshot_id) VALUES($1,$2,$3,$4)", [release, domain, key, values.snapshotId]);
}

type CurrentPerson = { id: string; bioguide_id: string; seat_cycle_id: string; state_code: string; district_code: string | null; kind: string };

async function enrichMembers(client: PoolClient, args: FullFactualArguments, legislators: Legislator[], committees: Committee[], assignments: Record<string, Assignment[]>): Promise<{ members: number; assignments: number }> {
  const people = await client.query<CurrentPerson>(`SELECT DISTINCT p.id,p.bioguide_id,sc.id seat_cycle_id,o.state_code,o.district_code,o.kind
    FROM people p JOIN memberships m ON m.release_id=p.release_id AND m.person_id=p.id
    JOIN office_terms ot ON ot.release_id=m.release_id AND ot.id=m.office_term_id
    JOIN seat_cycles sc ON sc.release_id=ot.release_id AND sc.office_term_id=ot.id
    JOIN offices o ON o.release_id=sc.release_id AND o.id=sc.office_id
    WHERE p.release_id=$1 AND m.starts_at <= $2::date AND (m.ends_at IS NULL OR $2::date < m.ends_at)`, [args.release, args.cutoff]);
  const byBioguide = new Map(legislators.map((row) => [row.id.bioguide, row]));
  if (people.rowCount !== legislators.length || people.rows.some((row) => !byBioguide.has(row.bioguide_id))) throw new Error("MEMBER_BIOGUIDE_CLOSURE_INVALID");
  await client.query("DELETE FROM biographical_fact_provenance WHERE release_id=$1 AND fact='birth_date'", [args.release]);
  await client.query("DELETE FROM biographical_facts WHERE release_id=$1 AND fact='birth_date'", [args.release]);
  for (const person of people.rows) {
    const legislator = byBioguide.get(person.bioguide_id)!;
    if (!datePattern.test(legislator.bio.birthday) || legislator.bio.birthday > args.cutoff) throw new Error(`MEMBER_BIRTHDAY_INVALID:${person.bioguide_id}`);
    await client.query("UPDATE people SET birth_date=$3 WHERE release_id=$1 AND id=$2", [args.release, person.id, legislator.bio.birthday]);
    await client.query("INSERT INTO biographical_facts(release_id,person_id,fact,value,value_missing_reason,effective_at) VALUES($1,$2,'birth_date',$3,NULL,$4)", [args.release, person.id, legislator.bio.birthday, args.cutoff]);
    await client.query("INSERT INTO biographical_fact_provenance(release_id,person_id,fact,effective_at,snapshot_id,role) VALUES($1,$2,'birth_date',$3,'snap_full_legislators','original_publisher')", [args.release, person.id, args.cutoff]);
  }
  const flattened = committees.flatMap((committee) => [
    { sourceId: committee.thomas_id, name: committee.name, type: committee.type },
    ...(committee.subcommittees ?? []).map((subcommittee) => ({ sourceId: subcommittee.thomas_id, name: `${committee.name}: ${subcommittee.name}`, type: `${committee.type}_subcommittee` })),
  ]);
  const committeeIds = new Map<string, string>();
  for (const committee of flattened) {
    const id = `committee_leg_${safeId(committee.sourceId)}`; committeeIds.set(committee.sourceId, id);
    await client.query("INSERT INTO committees(release_id,id,source_committee_id,name,committee_type) VALUES($1,$2,$3,$4,$5)", [args.release, id, committee.sourceId, committee.name, committee.type]);
    await client.query("INSERT INTO provenance(release_id,entity_type,entity_id,snapshot_id,role) VALUES($1,'committees',$2,'snap_full_committees','original_publisher')", [args.release, id]);
  }
  let assignmentCount = 0;
  const personIds = new Map(people.rows.map((row) => [row.bioguide_id, row.id]));
  for (const [sourceCommitteeId, members] of Object.entries(assignments)) {
    const committeeId = committeeIds.get(sourceCommitteeId);
    if (!committeeId) throw new Error(`COMMITTEE_ASSIGNMENT_TARGET_MISSING:${sourceCommitteeId}`);
    for (const member of members) {
      const personId = personIds.get(member.bioguide); if (!personId) continue;
      const role = member.title?.trim() || (member.party ? `${member.party} member` : "Member");
      await client.query("INSERT INTO committee_assignments(release_id,person_id,committee_id,role,effective_from,effective_to) VALUES($1,$2,$3,$4,'2025-01-03',NULL)", [args.release, personId, committeeId, role]);
      await client.query("INSERT INTO committee_assignment_provenance(release_id,person_id,committee_id,role_name,effective_from,snapshot_id,provenance_role) VALUES($1,$2,$3,$4,'2025-01-03','snap_full_assignments','original_publisher')", [args.release, personId, committeeId, role]);
      assignmentCount += 1;
    }
  }
  const memberKey = scopeKey("release");
  await replaceCoverage(client, args.release, "member", memberKey, { status: "complete", expected: people.rowCount, observed: people.rowCount, snapshotId: "snap_full_legislators" });
  await client.query("INSERT INTO coverage_input_snapshots(release_id,domain,scope_key,snapshot_id) VALUES($1,'member',$2,'snap_full_assignments')", [args.release, memberKey]);
  return { members: people.rowCount, assignments: assignmentCount };
}

async function enrichElections(client: PoolClient, args: FullFactualArguments, districts: PresidentialDistrict[]): Promise<number> {
  const seats = await client.query<{ id: string; state_code: string; district_code: string; geography_version_id: string }>("SELECT sc.id,o.state_code,o.district_code,sc.geography_version_id FROM seat_cycles sc JOIN offices o ON o.release_id=sc.release_id AND o.id=sc.office_id WHERE sc.release_id=$1 AND o.kind='house_voting'", [args.release]);
  const byDistrict = new Map(districts.map((row) => [`${row.state}-${row.district}`, row]));
  if (seats.rowCount !== 435 || seats.rows.some((seat) => !byDistrict.has(`${seat.state_code}-${seat.district_code}`))) throw new Error("ELECTION_SEAT_CLOSURE_INVALID");
  for (const seat of seats.rows) {
    const row = byDistrict.get(`${seat.state_code}-${seat.district_code}`)!;
    const suffix = `${seat.state_code.toLowerCase()}_${seat.district_code.toLowerCase()}`;
    const contest = `contest_president_2024_${suffix}`, dem = `option_harris_2024_${suffix}`, rep = `option_trump_2024_${suffix}`;
    await client.query("INSERT INTO contests(release_id,id,seat_cycle_id,kind,round,election_date,geography_version_id,certification_status,reporting_completeness_percent,denominator_votes,denominator_missing_reason,reporting_unit,allocation_method,allocation_coverage_percent,allocation_coverage_missing_reason,lineage_as_of,lineage_methodology,lineage_status) VALUES($1,$2,$3,'president_general','general','2024-11-05',$4,'modeled',100,$5,NULL,'district','other',100,NULL,'2025-04-23','downballot-cd-2024-exact-v1','modeled')", [args.release, contest, seat.id, seat.geography_version_id, row.total]);
    await client.query("INSERT INTO provenance(release_id,entity_type,entity_id,snapshot_id,role) VALUES($1,'contests',$2,'snap_full_elections','original_publisher')", [args.release, contest]);
    await client.query("INSERT INTO contest_lineage(release_id,contest_id,snapshot_id,role) VALUES($1,$2,'snap_full_elections','original_publisher')", [args.release, contest]);
    for (const [id, label, party, votes] of [[dem, "Kamala D. Harris", "democratic", row.harris], [rep, "Donald J. Trump", "republican", row.trump]] as const) {
      await client.query("INSERT INTO result_options(release_id,id,contest_id,candidacy_id,label,party,option_kind) VALUES($1,$2,$3,NULL,$4,$5,'candidate')", [args.release, id, contest, label, party]);
      await client.query("INSERT INTO provenance(release_id,entity_type,entity_id,snapshot_id,role) VALUES($1,'result_options',$2,'snap_full_elections','original_publisher')", [args.release, id]);
      await client.query("INSERT INTO election_results(release_id,contest_id,result_option_id,votes,votes_missing_reason,lineage_as_of,lineage_methodology,lineage_status) VALUES($1,$2,$3,$4,NULL,'2025-04-23','downballot-cd-2024-exact-v1','modeled')", [args.release, contest, id, votes]);
      await client.query("INSERT INTO election_result_lineage(release_id,contest_id,result_option_id,snapshot_id,role) VALUES($1,$2,$3,'snap_full_elections','original_publisher')", [args.release, contest, id]);
    }
  }
  const states = new Set(districts.map((row) => row.state));
  for (const state of states) {
    const key = scopeKey("election", { jurisdictionCode: state, electionYear: 2024 });
    await client.query("UPDATE election_decisions SET status='approved' WHERE release_id=$1 AND jurisdiction_code=$2 AND election_year=2024", [args.release, state]);
    const decision = await client.query<{ id: string }>("SELECT id FROM election_decisions WHERE release_id=$1 AND jurisdiction_code=$2 AND election_year=2024", [args.release, state]);
    await client.query("DELETE FROM election_decision_inputs WHERE release_id=$1 AND election_decision_id=$2", [args.release, decision.rows[0]!.id]);
    await client.query("INSERT INTO election_decision_inputs(release_id,election_decision_id,snapshot_id) VALUES($1,$2,'snap_full_elections')", [args.release, decision.rows[0]!.id]);
    await replaceCoverage(client, args.release, "election_2024", key, { status: "complete", expected: 1, observed: 1, snapshotId: "snap_full_elections" });
  }
  return seats.rowCount;
}

type FecChoice = { cycle: number; row: Json; snapshotId: string };
const value = (row: Json, key: string): string => String(row[key] ?? "");

async function enrichFinance(client: PoolClient, args: FullFactualArguments, legislators: Legislator[], summaryFiles: Array<{ cycle: number; rows: Json[]; snapshotId: string }>, ieRows: Json[]): Promise<{ summaries: number; missing: number; outside: number }> {
  const byFec = new Map<string, FecChoice>();
  for (const file of summaryFiles) for (const row of file.rows) {
    const candidateId = value(row, "Cand_Id"), coverage = value(row, "Coverage_End_Date"); if (!candidateId || !coverage) continue;
    const prior = byFec.get(candidateId); if (!prior || file.cycle > prior.cycle) byFec.set(candidateId, { cycle: file.cycle, row, snapshotId: file.snapshotId });
  }
  const byBioguide = new Map(legislators.map((row) => [row.id.bioguide, row]));
  const seats = await client.query<CurrentPerson>(`SELECT DISTINCT p.id,p.bioguide_id,sc.id seat_cycle_id,o.state_code,o.district_code,o.kind
    FROM seat_cycles sc JOIN offices o ON o.release_id=sc.release_id AND o.id=sc.office_id
    LEFT JOIN office_terms ot ON ot.release_id=sc.release_id AND ot.id=sc.office_term_id
    LEFT JOIN memberships m ON m.release_id=ot.release_id AND m.office_term_id=ot.id AND m.starts_at <= $2::date AND (m.ends_at IS NULL OR $2::date < m.ends_at)
    LEFT JOIN people p ON p.release_id=m.release_id AND p.id=m.person_id WHERE sc.release_id=$1`, [args.release, args.cutoff]);
  const ieLatest = new Map<string, Json>();
  for (const row of ieRows) {
    const key = `${value(row,"spe_id")}|${value(row,"cand_id")}|${value(row,"tran_id")}`; const prior = ieLatest.get(key);
    if (!prior || Number(value(row,"file_num")) > Number(value(prior,"file_num"))) ieLatest.set(key, row);
  }
  const ieByCandidate = new Map<string, Json[]>();
  for (const row of ieLatest.values()) { const id = value(row,"cand_id"); ieByCandidate.set(id, [...(ieByCandidate.get(id) ?? []), row]); }
  let summaries = 0, missing = 0, outside = 0;
  for (const seat of seats.rows) {
    const legislator = seat.bioguide_id ? byBioguide.get(seat.bioguide_id) : undefined;
    const expectedOffice = seat.kind === "senate" ? "S" : "H";
    const choices = (legislator?.id.fec ?? []).map((id) => byFec.get(id)).filter((choice): choice is FecChoice => Boolean(choice && value(choice.row,"Cand_Office") === expectedOffice)).sort((a,b) => b.cycle-a.cycle);
    const choice = choices[0];
    const summaryKey = scopeKey("funding", { seatCycleId: seat.seat_cycle_id, fundingKind: "summary" });
    const categoryKey = scopeKey("funding", { seatCycleId: seat.seat_cycle_id, fundingKind: "category" });
    const organizationKey = scopeKey("funding", { seatCycleId: seat.seat_cycle_id, fundingKind: "organization" });
    const outsideKey = scopeKey("funding", { seatCycleId: seat.seat_cycle_id, fundingKind: "outside_spending" });
    if (!choice) {
      const reason = legislator ? "not_reported" : "not_applicable"; missing += 1;
      for (const key of [summaryKey, categoryKey, organizationKey]) await replaceCoverage(client,args.release,"finance",key,{status:"unavailable",expected:1,observed:0,snapshotId:"snap_full_fec_2026",reason});
      await replaceCoverage(client,args.release,"finance",outsideKey,{status:"unavailable",expected:1,observed:0,snapshotId:"snap_full_fec_ie_2026",reason});
      continue;
    }
    const candidateId = value(choice.row,"Cand_Id"), coverageRaw = value(choice.row,"Coverage_End_Date");
    const coverage = `${coverageRaw.slice(0,4)}-${coverageRaw.slice(4,6)}-${coverageRaw.slice(6,8)}`;
    const committeeId = `committee_fec_${safeId(candidateId)}`, filingId = `filing_fec_summary_${choice.cycle}_${safeId(candidateId)}`, aggregateId = `finance_fec_summary_${choice.cycle}_${safeId(seat.seat_cycle_id)}`;
    await client.query("INSERT INTO committees(release_id,id,source_committee_id,name,committee_type) VALUES($1,$2,$3,$4,'fec_candidate_summary_rollup')", [args.release,committeeId,`summary:${choice.cycle}:${candidateId}`,`${value(choice.row,"Cand_Name")} authorized committee summary`]);
    await client.query("INSERT INTO provenance(release_id,entity_type,entity_id,snapshot_id,role) VALUES($1,'committees',$2,$3,'original_publisher')", [args.release,committeeId,choice.snapshotId]);
    const cash=number(value(choice.row,"Cash_On_Hand_COP")) ?? 0, receipts=number(value(choice.row,"Total_Receipt")) ?? 0, disbursements=number(value(choice.row,"Total_Disbursement")) ?? 0;
    await client.query("INSERT INTO fec_filing_summaries(release_id,id,seat_cycle_id,committee_id,source_filing_id,report_type,reporting_period_start,reporting_period_end,filed_at,amendment_number,amendment_status,amends_filing_id,cash_on_hand,cash_on_hand_missing_reason,total_receipts,total_receipts_missing_reason,total_disbursements,total_disbursements_missing_reason,lineage_as_of,lineage_methodology,lineage_status) VALUES($1,$2,$3,$4,$5,'candidate_summary_bulk',$6,$7,$8,0,'new',NULL,$9,NULL,$10,NULL,$11,NULL,$7,'fec-candidate-summary-bulk-v1','reported')", [args.release,filingId,seat.seat_cycle_id,committeeId,`candidate-summary:${choice.cycle}:${candidateId}`,`${choice.cycle-1}-01-01`,coverage,args.retrievedAt,cash,receipts,disbursements]);
    await client.query("INSERT INTO fec_filing_lineage(release_id,filing_id,snapshot_id,role) VALUES($1,$2,$3,'original_publisher')", [args.release,filingId,choice.snapshotId]);
    await client.query("UPDATE seat_finance_summaries SET filing_id=$3,missing_reason=NULL,as_of=NULL WHERE release_id=$1 AND seat_cycle_id=$2", [args.release,seat.seat_cycle_id,filingId]);
    await client.query("DELETE FROM seat_finance_summary_lineage WHERE release_id=$1 AND seat_cycle_id=$2", [args.release,seat.seat_cycle_id]);
    await client.query("INSERT INTO finance_aggregates(release_id,id,seat_cycle_id,as_of,coverage_through,reporting_period_start,cash_on_hand,cash_on_hand_missing_reason,receipts,receipts_missing_reason,disbursements,disbursements_missing_reason,methodology_version) VALUES($1,$2,$3,$4,$4,$5,$6,NULL,$7,NULL,$8,NULL,'fec-candidate-summary-bulk-v1')", [args.release,aggregateId,seat.seat_cycle_id,coverage,`${choice.cycle-1}-01-01`,cash,receipts,disbursements]);
    await client.query("INSERT INTO finance_aggregate_inputs(release_id,finance_aggregate_id,committee_id,filing_id,missing_reason) VALUES($1,$2,$3,$4,NULL)", [args.release,aggregateId,committeeId,filingId]);
    const categories = [["individual_contributions","Individual_Contribution"],["other_committee_contributions","Other_Committee_Contribution"],["party_committee_contributions","Party_Committee_Contribution"],["candidate_contributions","Cand_Contribution"],["transfers_from_authorized_committees","Transfer_From_Other_Auth_Committee"],["other_receipts","Other_Receipt"]] as const;
    for (const [category,column] of categories) {
      await client.query("INSERT INTO funding_category_aggregates(release_id,seat_cycle_id,category,amount,amount_missing_reason,coverage_through,methodology_version) VALUES($1,$2,$3,$4,NULL,$5,'fec-candidate-summary-categories-v1')", [args.release,seat.seat_cycle_id,category,number(value(choice.row,column)) ?? 0,coverage]);
      await client.query("INSERT INTO funding_category_input_snapshots(release_id,seat_cycle_id,category,coverage_through,methodology_version,snapshot_id) VALUES($1,$2,$3,$4,'fec-candidate-summary-categories-v1',$5)", [args.release,seat.seat_cycle_id,category,coverage,choice.snapshotId]);
    }
    const candidateIe = ieByCandidate.get(candidateId) ?? [];
    let support=0, oppose=0; const organizations=new Map<string,{id:string;name:string;amount:number}>();
    for (const row of candidateIe) { const amount=number(value(row,"exp_amo")) ?? 0; if(value(row,"sup_opp")==="S")support+=amount; else if(value(row,"sup_opp")==="O")oppose+=amount; const name=value(row,"spe_nam")||"Unidentified reporting committee"; const id=value(row,"spe_id")||name; organizations.set(id,{id,name,amount:(organizations.get(id)?.amount??0)+amount}); }
    await client.query("INSERT INTO outside_spending_aggregates(release_id,seat_cycle_id,support_amount,support_amount_missing_reason,oppose_amount,oppose_amount_missing_reason,coverage_through,methodology_version) VALUES($1,$2,$3,NULL,$4,NULL,$5,'fec-schedule-e-latest-transaction-v1')", [args.release,seat.seat_cycle_id,support,oppose,args.cutoff]);
    await client.query("INSERT INTO outside_spending_input_snapshots(release_id,seat_cycle_id,coverage_through,methodology_version,snapshot_id) VALUES($1,$2,$3,'fec-schedule-e-latest-transaction-v1','snap_full_fec_ie_2026')", [args.release,seat.seat_cycle_id,args.cutoff]);
    for (const organization of organizations.values()) {
      const organizationId=`funding_ie_${safeId(seat.seat_cycle_id)}_${safeId(organization.id)}`;
      await client.query("INSERT INTO funding_organization_aggregates(release_id,id,seat_cycle_id,organization_name,organization_external_id,amount,amount_missing_reason,coverage_through,methodology_version) VALUES($1,$2,$3,$4,$5,$6,NULL,$7,'fec-ie-spender-total-v1')",[args.release,organizationId,seat.seat_cycle_id,organization.name,organization.id,organization.amount,args.cutoff]);
      await client.query("INSERT INTO funding_organization_input_snapshots(release_id,aggregate_id,snapshot_id) VALUES($1,$2,'snap_full_fec_ie_2026')",[args.release,organizationId]);
    }
    await replaceCoverage(client,args.release,"finance",summaryKey,{status:"complete",expected:1,observed:1,snapshotId:choice.snapshotId});
    await replaceCoverage(client,args.release,"finance",categoryKey,{status:"complete",expected:1,observed:1,snapshotId:choice.snapshotId});
    await replaceCoverage(client,args.release,"finance",organizationKey,{status:"complete",expected:1,observed:1,snapshotId:"snap_full_fec_ie_2026"});
    await replaceCoverage(client,args.release,"finance",outsideKey,{status:"complete",expected:1,observed:1,snapshotId:"snap_full_fec_ie_2026"});
    summaries += 1; outside += 1;
  }
  return { summaries, missing, outside };
}

export async function executeFullFactual(argv: readonly string[]) {
  const args=parseFullFactualArguments(argv); const pool=getNationwideFinalizerPool();
  const [legislatorBytes,committeeBytes,assignmentBytes,electionBytes,ieBytes,...fecBytes]=await Promise.all([readFile(args.legislators),readFile(args.committees),readFile(args.assignments),readFile(args.elections),readFile(args.independentExpenditures),...args.fecSummaries.map((path) => readFile(path))]);
  const legislators=JSON.parse(legislatorBytes.toString("utf8")) as Legislator[]; const committees=JSON.parse(committeeBytes.toString("utf8")) as Committee[]; const assignments=JSON.parse(assignmentBytes.toString("utf8")) as Record<string,Assignment[]>; const districts=parsePresidentialDistricts(electionBytes.toString("utf8"));
  if(legislators.length!==537 || committees.length<40 || Object.keys(assignments).length<100) throw new Error("MEMBER_SOURCE_CLOSURE_INVALID");
  const summaryFiles=fecBytes.map((bytes,index)=>{const match=basename(args.fecSummaries[index]!).match(/(20\d{2})/);if(!match)throw new Error("FEC_SUMMARY_CYCLE_MISSING");const cycle=Number(match[1]);return{cycle,rows:records(bytes.toString("utf8")),snapshotId:`snap_full_fec_${cycle}`};}).sort((a,b)=>a.cycle-b.cycle);
  const client=await pool.connect(); try { await client.query("BEGIN"); for(const id of [args.release,args.sourceRelease].sort())await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release:' || $1))",[id]);
    const candidate=await client.query("SELECT 1 FROM data_releases WHERE id=$1 AND status='candidate' AND previous_release_id=$2",[args.release,args.sourceRelease]);if(candidate.rowCount!==1)throw new Error("FULL_FACTUAL_CANDIDATE_INVALID");
    await client.query("UPDATE data_releases SET source_cutoff=$2::date WHERE id=$1",[args.release,args.cutoff]); await client.query("UPDATE seat_cycles SET occupancy_as_of=$2::date WHERE release_id=$1",[args.release,args.cutoff]);
    const sourceFiles:SourceFile[]=[
      {id:"snap_full_legislators",sourceId:"src_full_legislators",sourceName:"United States Congress Legislators",authority:"editorial",homepage:"https://github.com/unitedstates/congress-legislators",url:"https://unitedstates.github.io/congress-legislators/legislators-current.json",license:"CC0-1.0",parser:"congress-legislators-json-v1",bytes:legislatorBytes},
      {id:"snap_full_committees",sourceId:"src_full_committees",sourceName:"United States Congress Committees",authority:"editorial",homepage:"https://github.com/unitedstates/congress-legislators",url:"https://unitedstates.github.io/congress-legislators/committees-current.json",license:"CC0-1.0",parser:"congress-committees-json-v1",bytes:committeeBytes},
      {id:"snap_full_assignments",sourceId:"src_full_assignments",sourceName:"United States Congress Committee Membership",authority:"editorial",homepage:"https://github.com/unitedstates/congress-legislators",url:"https://unitedstates.github.io/congress-legislators/committee-membership-current.json",license:"CC0-1.0",parser:"congress-committee-membership-json-v1",bytes:assignmentBytes},
      {id:"snap_full_elections",sourceId:"src_full_elections",sourceName:"The Downballot 2024 Presidential Results by Congressional District",authority:"editorial",homepage:"https://www.the-downballot.com/p/the-downballots-calculations-of-presidential",url:"https://docs.google.com/spreadsheets/d/1ng1i_Dm_RMDnEvauH44pgE6JCUsapcuu8F2pCfeLWFo/export?format=csv&gid=1491069057",license:"publisher-publication",parser:"downballot-cd-exact-csv-v1",bytes:electionBytes},
      ...summaryFiles.map((file,index)=>({id:file.snapshotId,sourceId:`src_full_fec_${file.cycle}`,sourceName:`FEC Candidate Summary ${file.cycle}`,authority:"official",homepage:"https://www.fec.gov/data/browse-data/",url:`file://${basename(args.fecSummaries[index]!)}`,license:"US-government-public-domain",parser:"fec-candidate-summary-csv-v1",bytes:fecBytes[index]!})),
      {id:"snap_full_fec_ie_2026",sourceId:"src_full_fec_ie_2026",sourceName:"FEC Independent Expenditures 2026",authority:"official",homepage:"https://www.fec.gov/data/browse-data/",url:"file://independent_expenditure_2026.csv",license:"US-government-public-domain",parser:"fec-independent-expenditure-csv-v1",bytes:ieBytes},
    ];
    for(const source of sourceFiles)await insertSource(client,args.release,args.retrievedAt,source);
    const member=await enrichMembers(client,args,legislators,committees,assignments); const electionCount=await enrichElections(client,args,districts); const finance=await enrichFinance(client,args,legislators,summaryFiles,records(ieBytes.toString("utf8")));
    const loaded=(await loadNationwideManifestForFinalization(client,args.release)).manifest; const canonical=computeCanonicalDataChecksum(loaded); const validation=validateReleaseManifest({...loaded,canonicalDataChecksumSha256:canonical});if(!validation.success)throw new Error(`FULL_FACTUAL_MANIFEST_INVALID:${validation.issues.map(issue=>`${issue.path}:${issue.message}`).join(";")}`);
    const metadata=await client.query<{geometry_checksum_sha256:string}>("SELECT geometry_checksum_sha256 FROM release_manifests WHERE release_id=$1",[args.release]);await client.query("UPDATE release_manifests SET canonical_data_checksum_sha256=$2,content_checksum_sha256=$3,validated_at=NULL WHERE release_id=$1",[args.release,canonical,expectedContentChecksum({canonical_data_checksum_sha256:canonical,geometry_checksum_sha256:metadata.rows[0]!.geometry_checksum_sha256} as never)]);await validateNationwideCandidateReleaseWithClient(client,args.release);await client.query("COMMIT");return{release:args.release,cutoff:args.cutoff,member,elections:electionCount,finance,status:"validated_candidate" as const};
  }catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error;}finally{client.release();}
}

export async function main(argv=process.argv.slice(2)){const result=await executeFullFactual(argv);process.stdout.write(`${JSON.stringify(result)}\n`);return result;}
if(require.main===module)main().catch((error:unknown)=>{process.stderr.write(`${error instanceof Error?error.message:"Full factual enrichment failed"}\n`);process.exitCode=1;}).finally(closeDb);
