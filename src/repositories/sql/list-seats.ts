import type { QueryResultRow } from "pg";

import type { ReleaseId, SeatCycleId } from "@/domain/contracts";
import { seatListItemSchema, seatPageSchema } from "@/domain/repository";
import type { SeatListItem, SeatPage, SeatPageRequest } from "@/domain/repository";
import { decodeSeatCursor, encodeSeatCursor, normalizedSeatQuery, type SeatCursor } from "../pagination";

/** The deliberately small database surface used by this read-only adapter. */
export interface SeatListSqlClient {
  query<T extends QueryResultRow>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
}

type Row = QueryResultRow & { item: unknown; sort_value: string | number | null; total: string | number };

const numericSorts = new Set(["election_year", "cash_on_hand", "presidential_margin_2024"]);

function normalizeSortValue(sort: keyof typeof sortExpressions, value: unknown): string | number | null {
  if (value === null) return null;
  if (numericSorts.has(sort)) {
    const numberValue = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
    if (!Number.isFinite(numberValue)) throw new Error("Invalid numeric sort value returned by database");
    return numberValue;
  }
  if (typeof value !== "string") throw new Error("Invalid text sort value returned by database");
  return value;
}

function parseSeatItem(input: unknown): SeatListItem {
  const item = input as Record<string, unknown>;
  const finance = item.cashOnHand as Record<string, unknown> | undefined;
  const cashOnHand = finance?.kind === "value" && (typeof finance.filedAt === "string" || finance.filedAt instanceof Date)
    ? { ...finance, filedAt: new Date(finance.filedAt).toISOString() }
    : finance;
  return seatListItemSchema.parse({ ...item, cashOnHand });
}

const asciiLower = (value: string): string => value.replace(/[A-Z]/g, (letter) => String.fromCharCode(letter.charCodeAt(0) + 32));
const likeLiteral = (value: string): string => `%${asciiLower(value).replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

/* These are constants rather than request interpolation: they are the only SQL identifiers/orderings accepted. */
const sortExpressions = {
  state: "state_code COLLATE \"C\"",
  district: "(CASE WHEN district_code = 'AL' THEN '00' ELSE district_code END) COLLATE \"C\"",
  incumbent_name: "incumbent_name COLLATE \"C\"",
  election_year: "election_year",
  cash_on_hand: "cash_sort",
  presidential_margin_2024: "margin_sort",
} as const;

function queryText(sort: keyof typeof sortExpressions, direction: "asc" | "desc", cursorPredicate: string, seatIdPredicate = ""): string {
  const expression = sortExpressions[sort];
  const cursorType = sort === "election_year" ? "int" : sort === "cash_on_hand" || sort === "presidential_margin_2024" ? "numeric" : "text";
  // Missing values are always last; seat id is always ascending, including descending value sorts.
  const order = `${expression} IS NULL ASC, ${expression} ${direction.toUpperCase()} NULLS LAST, seat_id COLLATE "C" ASC`;
  return `
WITH cursor_input AS (SELECT $8::${cursorType} AS sort_value, $9::text AS seat_id, $10::boolean AS missing), rooted AS (
 SELECT rps.seat_cycle_id AS seat_id, sc.cycle_year AS election_year, sc.incumbency_status,
   sc.occupancy_status, sc.occupancy_as_of, o.chamber, o.state_code, o.district_code,
   g.id AS geography_id, g.label AS coverage_label, (r.source_cutoff AT TIME ZONE 'UTC')::date AS cutoff,
   rm.schema_version
 FROM release_profile_seats rps
 JOIN data_releases r ON r.id = rps.release_id
 JOIN release_manifests rm ON rm.release_id = rps.release_id
 JOIN seat_cycles sc ON sc.release_id = rps.release_id AND sc.id = rps.seat_cycle_id
 JOIN offices o ON o.release_id = rps.release_id AND o.id = sc.office_id
 JOIN geography_versions g ON g.release_id = rps.release_id AND g.id = sc.geography_version_id
 JOIN office_terms ot ON ot.release_id = rps.release_id AND ot.id = sc.office_term_id
 WHERE rps.release_id = $1${seatIdPredicate}
), base AS (
 SELECT rooted.*, m.party AS incumbent_party, p.display_name AS incumbent_name,
   concat(state_code, '-', coalesce(district_code, 'Senate')) AS label,
   coalesce((SELECT array_agg(DISTINCT snapshot_id ORDER BY snapshot_id) FROM provenance
     WHERE release_id=$1 AND ((entity_type='offices' AND entity_id=(SELECT sc.office_id FROM seat_cycles sc WHERE sc.release_id=$1 AND sc.id=rooted.seat_id))
       OR (entity_type='geography_versions' AND entity_id=rooted.geography_id))), ARRAY[]::text[]) AS closure_snapshots
 FROM rooted
 LEFT JOIN LATERAL (
   SELECT * FROM memberships x WHERE rooted.occupancy_status='occupied' AND x.release_id=$1
     AND x.office_term_id=(SELECT office_term_id FROM seat_cycles WHERE release_id=$1 AND id=rooted.seat_id)
     AND x.starts_at <= rooted.occupancy_as_of AND (x.ends_at IS NULL OR rooted.occupancy_as_of < x.ends_at)
   ORDER BY x.starts_at DESC, x.id ASC LIMIT 1
 ) m ON true
 LEFT JOIN people p ON p.release_id=$1 AND p.id=m.person_id
), enriched AS (
 SELECT base.*,
   pc.metric AS presidential_metric, pc.sort_value AS margin_sort,
   fm.metric AS finance_metric, fm.sort_value AS cash_sort
 FROM base
 LEFT JOIN LATERAL (
   SELECT CASE WHEN c.id IS NOT NULL THEN jsonb_build_object(
     'value', CASE WHEN c.denominator_votes IS NULL THEN jsonb_build_object('kind','missing','reason',c.denominator_missing_reason)
       WHEN c.denominator_votes=0 THEN jsonb_build_object('kind','missing','reason','not_applicable')
       WHEN rr.missing_reason IS NOT NULL THEN jsonb_build_object('kind','missing','reason',rr.missing_reason)
       WHEN rr.republican_votes IS NULL OR rr.democratic_votes IS NULL THEN jsonb_build_object('kind','missing','reason','not_reported')
       ELSE jsonb_build_object('kind','value','value',((rr.republican_votes::float8-rr.democratic_votes::float8)/c.denominator_votes::float8)*100) END,
     'geographyVersionId',c.geography_version_id,'status',c.lineage_status,'asOf',c.lineage_as_of::text,'methodology',c.lineage_methodology,
     'inputSnapshotIds',coalesce((SELECT jsonb_agg(DISTINCT x.snapshot_id ORDER BY x.snapshot_id) FROM (
       SELECT snapshot_id FROM contest_lineage WHERE release_id=$1 AND contest_id=c.id
       UNION ALL SELECT erl.snapshot_id FROM election_result_lineage erl JOIN result_options ro ON ro.release_id=erl.release_id AND ro.id=erl.result_option_id AND ro.contest_id=erl.contest_id WHERE erl.release_id=$1 AND erl.contest_id=c.id AND ro.party IN ('republican','democratic')
       UNION ALL SELECT pr.snapshot_id FROM provenance pr JOIN result_options ro ON ro.release_id=pr.release_id AND ro.id=pr.entity_id WHERE pr.release_id=$1 AND pr.entity_type='result_options' AND ro.contest_id=c.id AND ro.party IN ('republican','democratic')
     ) x),'[]'::jsonb))
   ELSE jsonb_build_object('kind','coverage_missing','value',jsonb_build_object('kind','missing','reason',coalesce(ec.reason,'not_collected')),
     'reason',coalesce(ec.reason,'not_collected'),'asOf',base.cutoff::text,'methodology','coverage_missing','inputSnapshotIds',coalesce(ec.inputs,to_jsonb(base.closure_snapshots)),
     'geographyVersionId',base.geography_id,'status','reported') END AS metric,
   CASE WHEN c.denominator_votes IS NOT NULL AND c.denominator_votes<>0 AND rr.missing_reason IS NULL AND rr.republican_votes IS NOT NULL AND rr.democratic_votes IS NOT NULL THEN ((rr.republican_votes::float8-rr.democratic_votes::float8)/c.denominator_votes::float8)*100 END AS sort_value
   FROM (SELECT 1) present
   LEFT JOIN LATERAL (SELECT * FROM contests WHERE release_id=$1 AND seat_cycle_id=base.seat_id AND kind='president_general' AND round='general' AND election_date >= DATE '2024-01-01' AND election_date < DATE '2025-01-01' ORDER BY id ASC LIMIT 1) c ON true
   LEFT JOIN LATERAL (SELECT sum(er.votes) FILTER (WHERE ro.party='republican') AS republican_votes, sum(er.votes) FILTER (WHERE ro.party='democratic') AS democratic_votes, min(er.votes_missing_reason) FILTER (WHERE ro.party IN ('republican','democratic')) AS missing_reason FROM election_results er JOIN result_options ro ON ro.release_id=er.release_id AND ro.id=er.result_option_id AND ro.contest_id=er.contest_id WHERE er.release_id=$1 AND er.contest_id=c.id) rr ON true
   LEFT JOIN LATERAL (SELECT (SELECT mr.reason FROM coverage_missing_reasons mr WHERE mr.release_id=cr.release_id AND mr.domain=cr.domain AND mr.scope_key=cr.scope_key ORDER BY mr.reason ASC LIMIT 1) AS reason, jsonb_agg(DISTINCT cis.snapshot_id ORDER BY cis.snapshot_id) AS inputs FROM coverage_records cr LEFT JOIN coverage_input_snapshots cis ON cis.release_id=cr.release_id AND cis.domain=cr.domain AND cis.scope_key=cr.scope_key WHERE cr.release_id=$1 AND cr.domain='election_2024' AND cr.scope_kind='election' AND cr.jurisdiction_code=base.state_code AND cr.election_year=2024 GROUP BY cr.release_id,cr.domain,cr.scope_key ORDER BY cr.scope_key ASC LIMIT 1) ec ON true
 ) pc ON true
 LEFT JOIN LATERAL (
   /* v2 chooses max(as_of), then max(id), so revisions have a stable, documented winner. */
   SELECT CASE WHEN base.schema_version=1 THEN CASE WHEN s.filing_id IS NULL THEN jsonb_build_object('kind','missing','reason',s.missing_reason,'asOf',s.as_of::text,'inputSnapshotIds',coalesce(sl.inputs,'[]'::jsonb)) WHEN f.cash_on_hand IS NULL THEN jsonb_build_object('kind','missing','reason',f.cash_on_hand_missing_reason,'asOf',f.reporting_period_end::text,'inputSnapshotIds',fl.inputs) ELSE jsonb_build_object('kind','value','value',f.cash_on_hand::float8,'filingId',f.id,'committeeId',f.committee_id,'coverageThrough',f.reporting_period_end::text,'filedAt',f.filed_at,'inputSnapshotIds',fl.inputs) END
     WHEN a.id IS NOT NULL AND a.cash_on_hand IS NOT NULL THEN jsonb_build_object('kind','aggregate','value',a.cash_on_hand::float8,'aggregateId',a.id,'asOf',a.as_of::text,'coverageThrough',a.coverage_through::text,'methodologyVersion',a.methodology_version,'inputSnapshotIds',coalesce(ai.inputs,to_jsonb(base.closure_snapshots)),'reason','aggregate')
     WHEN a.id IS NOT NULL THEN jsonb_build_object('kind','missing','reason',a.cash_on_hand_missing_reason,'asOf',a.as_of::text,'inputSnapshotIds',coalesce(ai.inputs,to_jsonb(base.closure_snapshots)))
     WHEN fc.scope_key IS NOT NULL THEN jsonb_build_object('kind','missing','reason',coalesce(fc.reason,'not_reported'),'asOf',base.cutoff::text,'inputSnapshotIds',coalesce(fc.inputs,to_jsonb(base.closure_snapshots)))
     ELSE jsonb_build_object('kind','missing','reason','source_unavailable','asOf',base.cutoff::text,'inputSnapshotIds',to_jsonb(base.closure_snapshots)) END AS metric,
   CASE WHEN base.schema_version=1 THEN f.cash_on_hand WHEN a.cash_on_hand IS NOT NULL THEN a.cash_on_hand END AS sort_value
   FROM (SELECT 1) present
   LEFT JOIN LATERAL (SELECT * FROM seat_finance_summaries WHERE release_id=$1 AND seat_cycle_id=base.seat_id) s ON true
   LEFT JOIN fec_filing_summaries f ON f.release_id=$1 AND f.id=s.filing_id
   LEFT JOIN LATERAL (SELECT jsonb_agg(DISTINCT snapshot_id ORDER BY snapshot_id) AS inputs FROM fec_filing_lineage WHERE release_id=$1 AND filing_id=f.id) fl ON true
   LEFT JOIN LATERAL (SELECT jsonb_agg(DISTINCT snapshot_id ORDER BY snapshot_id) AS inputs FROM seat_finance_summary_lineage WHERE release_id=$1 AND seat_cycle_id=base.seat_id) sl ON true
   LEFT JOIN LATERAL (SELECT * FROM finance_aggregates WHERE release_id=$1 AND seat_cycle_id=base.seat_id ORDER BY as_of DESC,id DESC LIMIT 1) a ON base.schema_version=2
   LEFT JOIN LATERAL (SELECT jsonb_agg(DISTINCT fl2.snapshot_id ORDER BY fl2.snapshot_id) AS inputs FROM finance_aggregate_inputs fai JOIN fec_filing_lineage fl2 ON fl2.release_id=fai.release_id AND fl2.filing_id=fai.filing_id WHERE fai.release_id=$1 AND fai.finance_aggregate_id=a.id) ai ON true
   LEFT JOIN LATERAL (SELECT cr.scope_key,(SELECT mr.reason FROM coverage_missing_reasons mr WHERE mr.release_id=cr.release_id AND mr.domain=cr.domain AND mr.scope_key=cr.scope_key ORDER BY mr.reason ASC LIMIT 1) AS reason,jsonb_agg(DISTINCT cis.snapshot_id ORDER BY cis.snapshot_id) AS inputs FROM coverage_records cr LEFT JOIN coverage_input_snapshots cis ON cis.release_id=cr.release_id AND cis.domain=cr.domain AND cis.scope_key=cr.scope_key WHERE cr.release_id=$1 AND cr.domain='finance' AND cr.scope_kind='funding' AND cr.seat_cycle_id=base.seat_id AND cr.funding_kind='summary' GROUP BY cr.release_id,cr.domain,cr.scope_key ORDER BY cr.scope_key ASC LIMIT 1) fc ON true
 ) fm ON true
), filtered AS (
 SELECT *, ${sortExpressions[sort]} AS sort_value FROM enriched
 WHERE ($2::text IS NULL OR chamber=$2) AND ($3::text IS NULL OR state_code=$3) AND ($4::text IS NULL OR incumbent_party=$4) AND ($5::text IS NULL OR incumbency_status=$5) AND ($6::int IS NULL OR election_year=$6)
 AND ($7::text IS NULL OR translate(label,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') LIKE $7 ESCAPE '\\' OR translate(state_code,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') LIKE $7 ESCAPE '\\' OR translate(coalesce(district_code,''),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') LIKE $7 ESCAPE '\\' OR translate(coalesce(incumbent_name,''),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz') LIKE $7 ESCAPE '\\')
), total AS (SELECT count(*) AS total FROM filtered), paged AS (SELECT * FROM filtered WHERE ${cursorPredicate} ORDER BY ${order} LIMIT $11)
SELECT CASE WHEN paged.seat_id IS NULL THEN NULL ELSE jsonb_build_object('id',seat_id,'releaseId',$1,'chamber',chamber,'stateCode',state_code,'districtCode',district_code,'label',label,'incumbentName',incumbent_name,'incumbentParty',incumbent_party,'incumbencyStatus',incumbency_status,'electionYear',election_year,'presidentialMargin2024',presidential_metric,'cashOnHand',finance_metric,'coverageLabel',coverage_label) END AS item, paged.sort_value, total.total FROM total LEFT JOIN paged ON true`;
}

export interface SqlStatement { readonly text: string; readonly values: readonly unknown[]; }

/** Builds the finite, parameterized list statement used by both the adapter and query-plan evidence. */
export function buildSeatListStatement(releaseId: ReleaseId, request: SeatPageRequest): SqlStatement {
  const query = normalizedSeatQuery(request);
  const cursor = request.cursor ? decodeSeatCursor(request.cursor, releaseId, query) : null;
  const sort = query.sort;
  const op = query.direction === "asc" ? ">" : "<";
  const cursorType = sort === "election_year" ? "int" : sort === "cash_on_hand" || sort === "presidential_margin_2024" ? "numeric" : "text";
  const sortValue = cursorType === "text" ? 'sort_value COLLATE "C"' : "sort_value";
  const cursorValue = cursorType === "text" ? '$8::text COLLATE "C"' : `$8::${cursorType}`;
  const seatId = 'seat_id COLLATE "C"';
  const cursorId = '$9::text COLLATE "C"';
  const predicate = cursor === null ? `($8::${cursorType} IS NULL AND $9::text IS NULL AND $10::boolean = false)` : cursor.missing ? `(sort_value IS NULL AND ${seatId} > ${cursorId})` : `(sort_value IS NULL OR ${sortValue} ${op} ${cursorValue} OR (${sortValue} = ${cursorValue} AND ${seatId} > ${cursorId}))`;
  return { text: queryText(sort, query.direction, predicate), values: [releaseId, query.chamber ?? null, query.stateCode ?? null, query.party ?? null, query.incumbencyStatus ?? null, query.electionYear ?? null, query.identitySearch ? likeLiteral(query.identitySearch) : null, cursor?.sortValue ?? null, cursor?.id ?? null, cursor?.missing ?? false, request.limit + 1] };
}

export async function listSeatPage(client: SeatListSqlClient, releaseId: ReleaseId, request: SeatPageRequest): Promise<SeatPage> {
  const query = normalizedSeatQuery(request);
  const statement = buildSeatListStatement(releaseId, request);
  const result = await client.query<Row>(statement.text, [...statement.values]);
  const rows = result.rows.filter((row) => row.item !== null);
  const more = rows.length > request.limit;
  const items = rows.slice(0, request.limit).map((row) => parseSeatItem(row.item));
  const last = rows[Math.min(rows.length, request.limit) - 1];
  const lastSortValue = last ? normalizeSortValue(query.sort, last.sort_value) : null;
  return seatPageSchema.parse({ releaseId, items, total: result.rows[0] ? Number(result.rows[0].total) : 0, nextCursor: more && last ? encodeSeatCursor({ v: 1, releaseId, query, missing: lastSortValue === null, sortValue: lastSortValue, id: String((last.item as { id: string }).id) } as SeatCursor) : null });
}

/** Fetches one release-scoped list DTO without hydrating or scanning a prior page. */
export async function getSeatListItem(client: SeatListSqlClient, releaseId: ReleaseId, seatCycleId: SeatCycleId): Promise<SeatListItem | null> {
  const result = await client.query<Row>(
    queryText("state", "asc", "true", " AND rps.seat_cycle_id = $12"),
    [releaseId, null, null, null, null, null, null, null, null, false, 1, seatCycleId],
  );
  const item = result.rows.find((row) => row.item !== null)?.item;
  return item === undefined ? null : parseSeatItem(item);
}
