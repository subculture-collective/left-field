import { Client, type ClientConfig, type Pool, type PoolClient, type QueryResultRow } from "pg";
import { addressInputSchema, assertBoundedAddressResolution, type AddressResolver, type AddressInput, type AddressResolution } from "@/domain/address";
import { CallerAbortError, isCallerAbort, throwIfCallerAborted, type CensusGeocoder } from "./census-geocoder";

export interface HouseMatch { officeTermId: string; seatCycleId: string; geographyVersionId: string }
export interface SenateMatch { senateClass: 1 | 2 | 3; officeTermId: string; seatCycleId: string }
export type LocatorResult = { kind: "matched"; senateRepresentation: "two_seats" | "none"; houseSeat: HouseMatch; senateSeats: SenateMatch[] } | { kind: "unsupported" | "vintage_mismatch" | "geography_ambiguous" | "resolver_failure" };
export interface SeatLocator { preflight(releaseId: string, productVintage: string, signal?: AbortSignal): Promise<boolean>; locate(releaseId: string, productVintage: string, stateGeoid: string, districtGeoid: string, longitude: number, latitude: number, signal?: AbortSignal): Promise<LocatorResult> }
export type BackendCanceller = (processID: number) => Promise<boolean | void>;

const CANCEL_TIMEOUT_MS = 1_000;
function dedicatedCancellationConfig(pool: Pool): ClientConfig {
  const { user, database, password, port, host, connectionString, keepAlive, ssl, keepAliveInitialDelayMillis, application_name, fallback_application_name, client_encoding, options } = pool.options;
  return { user, database, password, port, host, connectionString, keepAlive, ssl, keepAliveInitialDelayMillis, application_name, fallback_application_name, client_encoding, options, connectionTimeoutMillis: CANCEL_TIMEOUT_MS, query_timeout: CANCEL_TIMEOUT_MS, statement_timeout: CANCEL_TIMEOUT_MS };
}
function defaultBackendCanceller(pool: Pool): BackendCanceller {
  return async (processID) => {
    const client = new Client(dedicatedCancellationConfig(pool));
    try { await client.connect(); return (await client.query<{ pg_cancel_backend: boolean }>("SELECT pg_cancel_backend($1)", [processID])).rows[0]?.pg_cancel_backend === true; }
    finally { await client.end().catch(() => undefined); }
  };
}

export class PostgresAddressResolver implements AddressResolver {
  constructor(private readonly pinned: { releaseId: string; productVintage: string }, private readonly geocoder: CensusGeocoder, private readonly locator: SeatLocator) {}
  async resolve(raw: AddressInput, signal?: AbortSignal): Promise<AddressResolution> {
    const input = addressInputSchema.parse(raw); const context = { releaseId: this.pinned.releaseId, productVintage: this.pinned.productVintage };
    const output = (value: unknown) => assertBoundedAddressResolution(value);
    throwIfCallerAborted(signal);
    try { if (!await this.locator.preflight(context.releaseId, context.productVintage, signal)) return output({ ...context, status: "resolver_failure", errorCode: "RELEASE_INVARIANT_FAILURE" }); }
    catch (error) { if (isCallerAbort(error, signal)) throw new CallerAbortError(); return output({ ...context, status: "resolver_failure", errorCode: "RELEASE_INVARIANT_FAILURE" }); }
    let coded;
    try { coded = await this.geocoder.geocode(input.address, signal); } catch (error) { if (isCallerAbort(error, signal)) throw new CallerAbortError(); return output({ ...context, status: "upstream_failure", errorCode: "GEOCODER_UNAVAILABLE" }); }
    const geo = { ...context, geocoderBenchmark: coded.benchmark, geocoderVintage: coded.vintage };
    if (coded.candidates.length === 0) return output({ ...geo, status: "no_match", matchQuality: "none", errorCode: "ADDRESS_NOT_FOUND" });
    if (coded.candidates.length > 1) return output({ ...geo, status: "ambiguous", matchQuality: "ambiguous", errorCode: "MULTIPLE_CANDIDATES" });
    const candidate = coded.candidates[0]!;
    if (!/^\d{2}$/.test(candidate.stateGeoid ?? "") || !/^\d{4}$/.test(candidate.congressionalDistrictGeoid ?? "")) return output({ ...context, status: "upstream_failure", errorCode: "GEOCODER_UNAVAILABLE" });
    if (candidate.congressionalDistrictGeoid!.slice(0, 2) !== candidate.stateGeoid) return output({ ...geo, matchQuality: "single_candidate", status: "vintage_mismatch", errorCode: "GEOGRAPHY_VINTAGE_MISMATCH" });
    try {
      const located = await this.locator.locate(context.releaseId, context.productVintage, candidate.stateGeoid!, candidate.congressionalDistrictGeoid!, candidate.longitude, candidate.latitude, signal);
      if (located.kind === "matched") return output({ ...geo, matchQuality: "single_candidate", status: "matched", senateRepresentation: located.senateRepresentation, houseSeat: located.houseSeat, senateSeats: located.senateSeats });
      const map = { unsupported: ["unsupported_prototype_coverage", "OUTSIDE_PROTOTYPE_COVERAGE"], vintage_mismatch: ["vintage_mismatch", "GEOGRAPHY_VINTAGE_MISMATCH"], geography_ambiguous: ["geography_ambiguous", "GEOGRAPHY_AMBIGUOUS"] } as const;
      if (located.kind in map) { const [status, errorCode] = map[located.kind as keyof typeof map]; return output({ ...geo, matchQuality: "single_candidate", status, errorCode }); }
    } catch (error) { if (isCallerAbort(error, signal)) throw new CallerAbortError(); /* database failures are resolver failures, never Census failures */ }
    return output({ ...context, status: "resolver_failure", errorCode: "RELEASE_INVARIANT_FAILURE" });
  }
}

/** One bounded read transaction. Deployment must prevent bind/slow-query logs from retaining coordinates. */
export class PostgresSeatLocator implements SeatLocator {
  private readonly statementTimeoutMs: number;
  private readonly acquireTimeoutMs: number;
  private readonly cancelBackend: BackendCanceller;
  constructor(private readonly pool: Pool, statementTimeoutMs = 5_000, cancelBackend?: BackendCanceller, acquireTimeoutMs = 1_000) { if (!Number.isSafeInteger(statementTimeoutMs) || statementTimeoutMs <= 0 || !Number.isSafeInteger(acquireTimeoutMs) || acquireTimeoutMs <= 0) throw new Error("Invalid statement timeout"); this.statementTimeoutMs = statementTimeoutMs; this.acquireTimeoutMs = acquireTimeoutMs; this.cancelBackend = cancelBackend ?? defaultBackendCanceller(pool); }
  private async acquire(signal?: AbortSignal): Promise<PoolClient> {
    throwIfCallerAborted(signal);
    let settled = false;
    const checkout = this.pool.connect();
    checkout.then((client) => { if (settled) client.release(true); }).catch(() => undefined);
    return await new Promise<PoolClient>((resolve, reject) => {
      const finish = (fn: () => void) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener("abort", onAbort); fn(); };
      const onAbort = () => finish(() => reject(new CallerAbortError()));
      const timer = setTimeout(() => finish(() => reject(new Error("Pool acquisition timeout"))), this.acquireTimeoutMs);
      checkout.then((client) => finish(() => resolve(client)), (error: unknown) => finish(() => reject(error)));
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted) onAbort();
    });
  }
  private async read<Row extends QueryResultRow>(query: string, values: readonly unknown[], signal?: AbortSignal) {
    throwIfCallerAborted(signal);
    const client = await this.acquire(signal); let begun = false; let active = true; let cancellation: Promise<boolean | void> | undefined; let destroy = false;
    const cancel = () => { if (!active || cancellation) return; const processID = (client as PoolClient & { processID: number }).processID; cancellation = this.cancelBackend(processID); };
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      throwIfCallerAborted(signal); await client.query("BEGIN"); begun = true;
      await client.query("SELECT set_config('statement_timeout',$1,true)", [String(this.statementTimeoutMs)]);
      throwIfCallerAborted(signal); const result = await client.query<Row>(query, values as unknown[]);
      await client.query("COMMIT"); begun = false; throwIfCallerAborted(signal); return result;
    } catch (error) { if (begun) { destroy = true; await client.query("ROLLBACK").catch(() => undefined); } if (isCallerAbort(error, signal)) { destroy = true; throw new CallerAbortError(); } throw error; }
    finally { active = false; signal?.removeEventListener("abort", cancel); if (cancellation) { try { if ((await cancellation) === false) destroy = true; } catch { destroy = true; } client.release(destroy); }
      else client.release(destroy); }
  }
  async preflight(releaseId: string, productVintage: string, signal?: AbortSignal): Promise<boolean> {
    const result = await this.read("SELECT EXISTS(SELECT 1 FROM data_releases r JOIN geography_versions g ON g.release_id=r.id AND g.kind='state' AND g.vintage=$2 JOIN release_profile_seats ps ON ps.release_id=r.id JOIN seat_cycles sc ON sc.release_id=ps.release_id AND sc.id=ps.seat_cycle_id JOIN geography_versions hg ON hg.release_id=sc.release_id AND hg.id=sc.geography_version_id AND hg.kind='house_district' AND hg.vintage=$2 WHERE r.id=$1 AND r.status='published') AS ok", [releaseId, productVintage], signal);
    return result.rows[0]?.ok === true;
  }
  async locate(releaseId: string, productVintage: string, stateGeoid: string, districtGeoid: string, longitude: number, latitude: number, signal?: AbortSignal): Promise<LocatorResult> {
    const q = `WITH p AS (
        SELECT ST_SetSRID(ST_MakePoint($5, $6), 4326) point
      ),
      s AS (
        SELECT * FROM geography_versions g
        WHERE g.release_id = $1 AND g.kind = 'state' AND g.vintage = $2 AND g.source_geoid = $3
      ),
      j AS (
        SELECT COALESCE(j.senate_representation, 'two_seats') senate_representation
        FROM s
        LEFT JOIN jurisdictions j ON j.release_id=s.release_id AND j.jurisdiction_code=s.state_code
        WHERE s.release_id=$1 AND (j.jurisdiction_code IS NOT NULL OR NOT EXISTS (SELECT 1 FROM jurisdictions all_j WHERE all_j.release_id=s.release_id))
      ),
      h AS (
        SELECT g.id, g.state_code, g.boundary, sc.id seat_cycle_id, sc.office_term_id
        FROM geography_versions g
        JOIN seat_cycles sc ON sc.release_id = g.release_id AND sc.geography_version_id = g.id
        JOIN release_profile_seats ps ON ps.release_id = sc.release_id AND ps.seat_cycle_id = sc.id
        WHERE g.release_id = $1 AND g.kind = 'house_district' AND g.vintage = $2 AND g.source_geoid = $4
      ),
      allh AS (
        SELECT g.id
        FROM geography_versions g
        JOIN seat_cycles sc ON sc.release_id = g.release_id AND sc.geography_version_id = g.id
        JOIN release_profile_seats ps ON ps.release_id = sc.release_id AND ps.seat_cycle_id = sc.id, p
        WHERE g.release_id = $1 AND g.kind = 'house_district' AND g.vintage = $2 AND ST_Covers(g.boundary, p.point)
      ),
      house AS (
        SELECT json_build_object('officeTermId', h.office_term_id, 'seatCycleId', h.seat_cycle_id, 'geographyVersionId', h.id) value
        FROM h JOIN geography_versions g ON g.release_id = $1 AND g.id = h.id, p, s
        WHERE h.state_code = s.state_code AND ST_Covers(g.boundary, p.point)
      ),
      senate AS (
        SELECT json_agg(json_build_object('senateClass', o.senate_class, 'officeTermId', ot.id, 'seatCycleId', sc.id) ORDER BY o.senate_class) value
        FROM offices o
        JOIN office_terms ot ON ot.release_id = o.release_id AND ot.office_id = o.id
        JOIN seat_cycles sc ON sc.release_id = o.release_id AND sc.office_term_id = ot.id
        JOIN data_releases r ON r.id = o.release_id
        JOIN s ON s.release_id = o.release_id AND s.state_code = o.state_code
        JOIN j ON j.senate_representation = 'two_seats'
        WHERE o.release_id = $1 AND o.chamber = 'senate'
          AND ot.starts_at <= (r.source_cutoff AT TIME ZONE 'UTC')::date
          AND ot.ends_at > (r.source_cutoff AT TIME ZONE 'UTC')::date
      )
      SELECT
        (SELECT count(*)::int FROM s) state_loaded,
        (SELECT count(*)::int FROM h) house_loaded,
        (SELECT count(*)::int FROM s, p WHERE ST_Covers(s.boundary, p.point)) state_covers,
        (SELECT count(*)::int FROM h, p WHERE ST_Covers(h.boundary, p.point)) house_covers,
        (SELECT count(*)::int FROM allh) all_house_covers,
        (SELECT count(*)::int FROM j) jurisdiction_loaded,
        (SELECT senate_representation FROM j) senate_representation,
        (SELECT count(*)::int FROM data_releases WHERE id=$1 AND status='published') release_published,
        (SELECT json_agg(value) FROM house) house,
        (SELECT value FROM senate) senate
    `;
    const row = (await this.read(q, [releaseId, productVintage, stateGeoid, districtGeoid, longitude, latitude], signal)).rows[0];
    if (!row) return { kind: "resolver_failure" }; if (Number(row.release_published) !== 1 || Number(row.state_loaded) !== 1 || Number(row.jurisdiction_loaded) !== 1 || Number(row.house_loaded) !== 1) return !row.state_loaded || !row.house_loaded ? { kind: "unsupported" } : { kind: "resolver_failure" }; if (Number(row.all_house_covers) > 1) return { kind: "geography_ambiguous" }; if (!row.state_covers || !row.house_covers) return { kind: "vintage_mismatch" };
    const house = Array.isArray(row.house) ? row.house : []; const senate = Array.isArray(row.senate) ? row.senate : [];
    const policy = row.senate_representation;
    if (house.length !== 1 || !house[0] || (policy !== "two_seats" && policy !== "none") || (policy === "two_seats" && (senate.length !== 2 || senate.some((seat: unknown) => !seat || typeof seat !== "object"))) || (policy === "none" && senate.length !== 0)) return { kind: "resolver_failure" };
    return { kind: "matched", senateRepresentation: policy, houseSeat: house[0] as HouseMatch, senateSeats: senate as SenateMatch[] };
  }
}
