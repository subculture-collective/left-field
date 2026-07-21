import { describe, expect, it } from "vitest";

import { decodeSeatCursor, encodeSeatCursor } from "../pagination";
import { buildSeatListStatement, listSeatPage } from "./list-seats";

const releaseId = "rel_sql_list" as never;
const request = { limit: 1, sort: "state" as const, direction: "asc" as const };
const item = {
  id: "seat_sql_list", releaseId, chamber: "house", officeKind: "house_voting", stateCode: "NY", districtCode: "01", label: "NY-01",
  incumbentName: null, incumbentParty: null, incumbencyStatus: "open", electionYear: 2026, coverageLabel: "New York 1",
  presidentialMargin2024: { kind: "coverage_missing", value: { kind: "missing", reason: "not_collected" }, reason: "not_collected", asOf: "2026-01-01", methodology: "coverage_missing", inputSnapshotIds: ["snap_identity"], geographyVersionId: "geo_sql_list", status: "reported" },
  cashOnHand: { kind: "missing", reason: "source_unavailable", asOf: "2026-01-01", inputSnapshotIds: ["snap_identity"] },
};

function recording(rows: Array<{ item: unknown; sort_value: string | number | null; total: string | number }> = [{ item, sort_value: "NY", total: "1" }]) {
  const calls: Array<{ text: string; values: readonly unknown[] }> = [];
  return { calls, client: { query: async <T,>(text: string, values: unknown[] = []) => { calls.push({ text, values }); return { rows: rows as T[] }; } } };
}

describe("direct SQL seat list", () => {
  it("binds literal search text and does not import the manifest projection", async () => {
    const fake = recording();
    await listSeatPage(fake.client, releaseId, { ...request, identitySearch: "%A_B" });
    expect(fake.calls[0]!.values[6]).toBe("%\\%a\\_b%");
    expect(fake.calls[0]!.text).toContain("LIKE $7 ESCAPE");
    expect(fake.calls[0]!.text).toContain("release_profile_seats");
    expect(fake.calls[0]!.text).not.toContain("loadPrototypeManifest");
  });

  it("continues through tied missing values after a missing cursor", async () => {
    const query = { identitySearch: undefined, chamber: undefined, stateCode: undefined, party: undefined, incumbencyStatus: undefined, electionYear: undefined, sort: "cash_on_hand" as const, direction: "desc" as const };
    const cursor = encodeSeatCursor({ v: 1, releaseId, query, missing: true, sortValue: null, id: "seat_last" });
    const fake = recording([{ item: { ...item, id: "seat_next" }, sort_value: null, total: "3" }]);
    await expect(listSeatPage(fake.client, releaseId, { limit: 1, sort: "cash_on_hand", direction: "desc", cursor })).resolves.toMatchObject({ items: [{ id: "seat_next" }], total: 3 });
    expect(fake.calls[0]!.text).toContain('sort_value IS NULL AND seat_id COLLATE "C" > $9::text COLLATE "C"');
    expect(fake.calls[0]!.text).toContain('seat_id COLLATE "C" ASC');
  });

  it("uses value comparison plus an ascending seat-id tie after a non-missing cursor", async () => {
    const query = { identitySearch: undefined, chamber: undefined, stateCode: undefined, party: undefined, incumbencyStatus: undefined, electionYear: undefined, sort: "state" as const, direction: "asc" as const };
    const fake = recording([]);
    await listSeatPage(fake.client, releaseId, { ...request, cursor: encodeSeatCursor({ v: 1, releaseId, query, missing: false, sortValue: "NY", id: "seat_last" }) });
    expect(fake.calls[0]!.text).toContain('sort_value COLLATE "C" > $8::text COLLATE "C" OR (sort_value COLLATE "C" = $8::text COLLATE "C" AND seat_id COLLATE "C" > $9::text COLLATE "C")');
    expect(fake.calls[0]!.values[7]).toBe("NY");
  });

  it("keeps the full filtered total on an empty later page", async () => {
    const query = { identitySearch: undefined, chamber: undefined, stateCode: undefined, party: undefined, incumbencyStatus: undefined, electionYear: undefined, sort: "state" as const, direction: "asc" as const };
    const fake = recording([{ item: null, sort_value: null, total: "3" }]);
    await expect(listSeatPage(fake.client, releaseId, { ...request, cursor: encodeSeatCursor({ v: 1, releaseId, query, missing: false, sortValue: "ZZ", id: "seat_last" }) })).resolves.toMatchObject({ items: [], total: 3, nextCursor: null });
    expect(fake.calls[0]!.text).toContain("total AS (SELECT count(*) AS total FROM filtered)");
    expect(fake.calls[0]!.text).toContain("FROM total LEFT JOIN paged ON true");
  });

  it("anchors absent presidential contests and uses deterministic, party-scoped missing data", async () => {
    const fake = recording();
    await listSeatPage(fake.client, releaseId, request);
    const text = fake.calls[0]!.text;
    expect(text).toContain("FROM (SELECT 1) present\n   LEFT JOIN LATERAL (SELECT * FROM contests");
    expect(text).toContain("min(er.votes_missing_reason) FILTER (WHERE ro.party IN ('republican','democratic'))");
    expect(text).toContain("ORDER BY mr.reason ASC LIMIT 1");
    expect(text).toContain("jsonb_agg(DISTINCT cis.snapshot_id ORDER BY cis.snapshot_id)");
  });

  it("casts numeric keyset cursor values explicitly", async () => {
    const query = { identitySearch: undefined, chamber: undefined, stateCode: undefined, party: undefined, incumbencyStatus: undefined, electionYear: undefined, sort: "cash_on_hand" as const, direction: "desc" as const };
    const fake = recording([]);
    await listSeatPage(fake.client, releaseId, { limit: 1, sort: "cash_on_hand", direction: "desc", cursor: encodeSeatCursor({ v: 1, releaseId, query, missing: false, sortValue: 12, id: "seat_last" }) });
    expect(fake.calls[0]!.text).toContain('sort_value < $8::numeric OR (sort_value = $8::numeric AND seat_id COLLATE "C" > $9::text COLLATE "C")');
  });

  it("normalizes PostgreSQL numeric sort values before encoding a cursor", async () => {
    const fake = recording([{ item, sort_value: "12.5", total: "2" }, { item: { ...item, id: "seat_next" }, sort_value: "13", total: "2" }]);
    const page = await listSeatPage(fake.client, releaseId, { limit: 1, sort: "cash_on_hand", direction: "asc" });
    const query = { identitySearch: undefined, chamber: undefined, stateCode: undefined, party: undefined, incumbencyStatus: undefined, electionYear: undefined, sort: "cash_on_hand" as const, direction: "asc" as const };
    expect(page.nextCursor).not.toBeNull();
    expect(decodeSeatCursor(page.nextCursor!, releaseId, query)).toMatchObject({ missing: false, sortValue: 12.5 });
  });

  it("rejects invalid database sort values before encoding a cursor", async () => {
    const fake = recording([{ item, sort_value: "not-a-number", total: "2" }, { item: { ...item, id: "seat_next" }, sort_value: "13", total: "2" }]);
    await expect(listSeatPage(fake.client, releaseId, { limit: 1, sort: "cash_on_hand", direction: "asc" })).rejects.toThrow("Invalid numeric sort value returned by database");
  });

  it("rejects cursor type and missing-value contradictions before SQL", () => {
    const query = { identitySearch: undefined, chamber: undefined, stateCode: undefined, party: undefined, incumbencyStatus: undefined, electionYear: undefined, sort: "state" as const, direction: "asc" as const };
    const numericQuery = { ...query, sort: "election_year" as const };
    const encoded = (cursor: unknown) => Buffer.from(JSON.stringify(cursor)).toString("base64url");
    expect(() => decodeSeatCursor(encoded({ v: 1, releaseId, query, missing: false, sortValue: 1, id: "seat_last" }), releaseId, query)).toThrow("Seat page cursor does not match this request");
    expect(() => decodeSeatCursor(encoded({ v: 1, releaseId, query: numericQuery, missing: false, sortValue: "2026", id: "seat_last" }), releaseId, numericQuery)).toThrow("Seat page cursor does not match this request");
    expect(() => buildSeatListStatement(releaseId, { ...request, cursor: encoded({ v: 1, releaseId, query, missing: true, sortValue: "NY", id: "seat_last" }) })).toThrow("Seat page cursor does not match this request");
    expect(() => decodeSeatCursor(encoded({ v: 1, releaseId, query, missing: false, sortValue: null, id: "seat_last" }), releaseId, query)).toThrow("Seat page cursor does not match this request");
  });

  it("uses bytewise collation for text keys and UTC for cutoffs", () => {
    const statement = buildSeatListStatement(releaseId, request);
    const district = buildSeatListStatement(releaseId, { ...request, sort: "district" });
    const incumbentName = buildSeatListStatement(releaseId, { ...request, sort: "incumbent_name" });
    expect(statement.text).toContain('state_code COLLATE "C" ASC NULLS LAST, seat_id COLLATE "C" ASC');
    expect(district.text).toContain('(CASE WHEN district_code = \'AL\' THEN \'00\' ELSE district_code END) COLLATE "C"');
    expect(incumbentName.text).toContain('incumbent_name COLLATE "C"');
    expect(statement.text).toContain("(r.source_cutoff AT TIME ZONE 'UTC')::date AS cutoff");
    expect(statement.text).not.toContain("r.source_cutoff::date");
  });

  it("projects the canonical office kind required by the list DTO", () => {
    const statement = buildSeatListStatement(releaseId, request);
    expect(statement.text).toContain("o.kind AS office_kind");
    expect(statement.text).toContain("'officeKind',office_kind");
  });
});
