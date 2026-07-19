import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import {
  reconcileHouseRoster,
  type HouseSeat,
  type NormalizedIdentityRecord,
} from "./house";
import {
  parseSenateServiceStartsArtifact,
  reconcileSenateRoster,
  type SenateJurisdictionPolicy,
  type SenateSeat,
} from "./senate";
import type { RawObjectStore } from "../core/raw-object-store";
import type {
  ExtractContext,
  RawObject,
  SourceAdapter,
  ValidationIssue,
} from "../core/types";
import type { ReleaseId, SnapshotId } from "@/domain/contracts";

export const IDENTITY_ARTIFACT_LIMITS = {
  houseBytes: 2 * 1024 * 1024,
  senateBytes: 1024 * 1024,
  senateServiceStartsBytes: 1024 * 1024,
  derivedEnvelopeBytes: 8 * 1024 * 1024,
} as const;
const sha256 = (v: Uint8Array) => createHash("sha256").update(v).digest("hex");
const validHash = (v: unknown): v is string =>
  typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const utf8 = (v: Uint8Array) =>
  new TextDecoder("utf-8", { fatal: true }).decode(v);
const bytewise = (a: string, b: string) =>
  Buffer.compare(Buffer.from(a), Buffer.from(b));
const abort = (s?: AbortSignal) => {
  if (s?.aborted) throw new Error("INGEST_ABORTED");
};
const object = (v: unknown, code: string): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error(code);
  return v as Record<string, unknown>;
};
const exact = (
  v: Record<string, unknown>,
  keys: readonly string[],
  code: string,
) => {
  if (Object.keys(v).length !== keys.length || keys.some((k) => !(k in v)))
    throw new Error(code);
};
async function body(v: Uint8Array): Promise<AsyncIterable<Uint8Array>> {
  return (async function* () {
    for (let i = 0; i < v.byteLength; i += 1024 * 1024)
      yield v.subarray(i, i + 1024 * 1024);
  })();
}

export interface IdentitySourceInput {
  readonly bytes: Uint8Array;
  readonly url: string;
  readonly checksumSha256: string;
  readonly lockId: string;
}
export interface IdentityAdapterOptions {
  readonly rawStore: RawObjectStore;
  readonly snapshotId: SnapshotId;
  readonly upstreamRelease: string;
  readonly parserVersion: string;
  readonly releaseCutoff: string;
  readonly sourceLockSha256: string;
  readonly house: IdentitySourceInput;
  readonly senate: IdentitySourceInput;
  readonly senateServiceStarts: IdentitySourceInput;
  readonly houseUniverse: readonly HouseSeat[];
  readonly senateUniverse: readonly SenateSeat[];
  readonly senatePolicy: SenateJurisdictionPolicy;
  readonly finalizeNationwide?: (
    client: PoolClient,
    runId: string,
    releaseId: ReleaseId,
  ) => Promise<void>;
}
export interface IdentityStageRow {
  readonly sourceNaturalKey: string;
  readonly entityId: string;
  readonly sourceEntityId: string;
  readonly displayName: string;
  readonly officeChamber: "house" | "senate";
  readonly officeStateCode: string;
  readonly officeDistrictCode: string | null;
  readonly vacancy: boolean;
}
export interface IdentityEnvelopeComponent {
  readonly lockId: string;
  readonly url: string;
  readonly base64: string;
  readonly byteLength: number;
  readonly checksumSha256: string;
}
export interface IdentityEnvelopeV1 {
  readonly schemaVersion: 1;
  readonly parserVersion: string;
  readonly upstreamRelease: string;
  readonly releaseCutoff: string;
  readonly sourceLockSha256: string;
  readonly components: {
    readonly house: IdentityEnvelopeComponent;
    readonly senate: IdentityEnvelopeComponent;
    readonly senateServiceStarts: IdentityEnvelopeComponent;
  };
  readonly houseUniverse: readonly HouseSeat[];
  readonly senateUniverse: readonly SenateSeat[];
  readonly senatePolicy: { readonly noSenateJurisdictions: readonly string[] };
  readonly compiledFactsSha256?: string;
  readonly rows: readonly IdentityStageRow[];
}
export type IdentityReplayInput = Pick<
  IdentityEnvelopeV1,
  | "components"
  | "houseUniverse"
  | "senateUniverse"
  | "senatePolicy"
  | "releaseCutoff"
>;
const attestations = new WeakMap<
  readonly NormalizedIdentityRecord[],
  IdentityReplayInput
>();
const isNormalizedIdentityRecords = (
  input:
    | Pick<
        IdentityReplayInput,
        "houseUniverse" | "senateUniverse" | "senatePolicy"
      >
    | readonly NormalizedIdentityRecord[],
): input is readonly NormalizedIdentityRecord[] => Array.isArray(input);

function component(
  input: IdentitySourceInput,
  limit: number,
  lockId: string,
): IdentityEnvelopeComponent {
  if (
    input.lockId !== lockId ||
    !input.url ||
    input.bytes.byteLength > limit ||
    !validHash(input.checksumSha256) ||
    sha256(input.bytes) !== input.checksumSha256
  )
    throw new Error("IDENTITY_SOURCE_RECEIPT_MISMATCH");
  return {
    lockId,
    url: input.url,
    base64: Buffer.from(input.bytes).toString("base64"),
    byteLength: input.bytes.byteLength,
    checksumSha256: input.checksumSha256,
  };
}
function decodeComponent(
  value: unknown,
  limit: number,
  lockId: string,
): IdentityEnvelopeComponent {
  const c = object(value, "IDENTITY_ENVELOPE_INVALID_COMPONENT");
  exact(
    c,
    ["lockId", "url", "base64", "byteLength", "checksumSha256"],
    "IDENTITY_ENVELOPE_UNKNOWN_FIELD",
  );
  if (
    c.lockId !== lockId ||
    typeof c.url !== "string" ||
    !c.url ||
    typeof c.base64 !== "string" ||
    typeof c.byteLength !== "number" ||
    !Number.isSafeInteger(c.byteLength) ||
    c.byteLength < 0 ||
    c.byteLength > limit ||
    !validHash(c.checksumSha256)
  )
    throw new Error("IDENTITY_ENVELOPE_INVALID_COMPONENT");
  const bytes = Buffer.from(c.base64, "base64");
  if (
    bytes.toString("base64") !== c.base64 ||
    bytes.byteLength !== c.byteLength ||
    sha256(bytes) !== c.checksumSha256
  )
    throw new Error("IDENTITY_ENVELOPE_COMPONENT_RECEIPT_MISMATCH");
  return {
    lockId,
    url: c.url,
    base64: c.base64,
    byteLength: c.byteLength,
    checksumSha256: c.checksumSha256,
  };
}
function stageRow(r: NormalizedIdentityRecord): IdentityStageRow {
  return r.person
    ? {
        sourceNaturalKey: r.sourceNaturalKey,
        entityId: r.person.bioguideId,
        sourceEntityId: r.person.bioguideId,
        displayName: r.person.displayName,
        officeChamber: r.office.chamber,
        officeStateCode: r.office.stateCode,
        officeDistrictCode: r.office.districtCode,
        vacancy: false,
      }
    : {
        sourceNaturalKey: r.sourceNaturalKey,
        entityId: `__vacancy__:${r.sourceNaturalKey}`,
        sourceEntityId: `__vacancy__:${r.sourceNaturalKey}`,
        displayName: "Vacant",
        officeChamber: r.office.chamber,
        officeStateCode: r.office.stateCode,
        officeDistrictCode: r.office.districtCode,
        vacancy: true,
      };
}
export function replayIdentityFacts(
  e: IdentityReplayInput,
): readonly NormalizedIdentityRecord[] {
  const house = reconcileHouseRoster(
    utf8(Buffer.from(e.components.house.base64, "base64")),
    e.houseUniverse,
    e.releaseCutoff,
  );
  const senate = reconcileSenateRoster(
    utf8(Buffer.from(e.components.senate.base64, "base64")),
    e.senateUniverse,
    { noSenateJurisdictions: new Set(e.senatePolicy.noSenateJurisdictions) },
    parseSenateServiceStartsArtifact(
      utf8(Buffer.from(e.components.senateServiceStarts.base64, "base64")),
    ),
    e.releaseCutoff,
  );
  if (house.errors.length || senate.errors.length)
    throw new Error(
      `IDENTITY_COMPILATION_FAILED:${[...house.errors, ...senate.errors][0]!.code}`,
    );
  const facts = [...house.records, ...senate.records].sort((a, b) =>
    bytewise(a.sourceNaturalKey, b.sourceNaturalKey),
  );
  if (
    facts.length !== 541 ||
    facts.filter((x) => x.office.chamber === "house").length !== 441 ||
    new Set(facts.map((x) => x.sourceNaturalKey)).size !== 541
  )
    throw new Error("IDENTITY_UNIVERSE_INCOMPLETE");
  attestations.set(facts, e);
  return facts;
}
const canonical = (n: string, v: string | null) => {
  const a = Buffer.from(n),
    b = v === null ? Buffer.alloc(0) : Buffer.from(v);
  return Buffer.concat([
    Buffer.from(`${a.byteLength}:`),
    a,
    Buffer.from(v === null ? "N" : `S${b.byteLength}:`),
    b,
  ]);
};
export function compiledFactsSha256(
  records: readonly NormalizedIdentityRecord[],
): string;
export function compiledFactsSha256(
  envelope: Pick<
    IdentityReplayInput,
    "houseUniverse" | "senateUniverse" | "senatePolicy"
  >,
  records: readonly NormalizedIdentityRecord[],
): string;
export function compiledFactsSha256(
  input:
    | Pick<
        IdentityReplayInput,
        "houseUniverse" | "senateUniverse" | "senatePolicy"
      >
    | readonly NormalizedIdentityRecord[],
  supplied?: readonly NormalizedIdentityRecord[],
): string {
  const records = isNormalizedIdentityRecords(input) ? input : supplied;
  const e = isNormalizedIdentityRecords(input)
    ? attestations.get(input)
    : input;
  if (!records || !e) throw new Error("IDENTITY_FACTS_ATTESTATION_MISSING");
  const out: Buffer[] = [];
  for (const r of [...records].sort((a, b) =>
    bytewise(a.sourceNaturalKey, b.sourceNaturalKey),
  )) {
    const m = r.membership;
    for (const [n, v] of [
      ["record", null],
      ["sourceNaturalKey", r.sourceNaturalKey],
      ["officeChamber", r.office.chamber],
      ["officeStateCode", r.office.stateCode],
      ["officeDistrictCode", r.office.districtCode],
      [
        "officeSenateClass",
        r.office.senateClass === null ? null : String(r.office.senateClass),
      ],
      ["officeKind", r.office.kind],
      ["personBioguideId", r.person?.bioguideId ?? null],
      ["personDisplayName", r.person?.displayName ?? null],
      ["vacancy", r.person ? "false" : "true"],
      ["party", m?.party ?? null],
      ["serviceStartedAt", m?.serviceStartedAt ?? null],
      ["termStartsAt", m?.termStartsAt ?? null],
      ["termEndsAt", m?.termEndsAt ?? null],
      ["electedAt", m?.electedAt ?? null],
      ["swornAt", m?.swornAt ?? null],
    ] as const)
      out.push(canonical(n, v));
    out.push(Buffer.from("\n"));
  }
  for (const x of [...e.houseUniverse].sort((a, b) =>
    bytewise(
      `${a.stateCode}:${a.districtCode}:${a.kind}`,
      `${b.stateCode}:${b.districtCode}:${b.kind}`,
    ),
  )) {
    for (const [n, v] of [
      ["houseUniverse", null],
      ["stateCode", x.stateCode],
      ["districtCode", x.districtCode],
      ["kind", x.kind],
      ["termStartsAt", x.termStartsAt ?? null],
      ["termEndsAt", x.termEndsAt ?? null],
    ] as const)
      out.push(canonical(n, v));
    out.push(Buffer.from("\n"));
  }
  for (const x of [...e.senateUniverse].sort((a, b) =>
    bytewise(
      `${a.stateCode}:${a.senateClass}`,
      `${b.stateCode}:${b.senateClass}`,
    ),
  )) {
    for (const [n, v] of [
      ["senateUniverse", null],
      ["stateCode", x.stateCode],
      ["senateClass", String(x.senateClass)],
      ["termStartsAt", x.termStartsAt ?? null],
      ["termEndsAt", x.termEndsAt ?? null],
    ] as const)
      out.push(canonical(n, v));
    out.push(Buffer.from("\n"));
  }
  for (const x of [...e.senatePolicy.noSenateJurisdictions].sort(bytewise)) {
    out.push(canonical("noSenateJurisdiction", x), Buffer.from("\n"));
  }
  return sha256(Buffer.concat(out));
}
export const encodeIdentityEnvelope = (e: IdentityEnvelopeV1): Uint8Array =>
  Buffer.from(JSON.stringify(e));
export function decodeIdentityEnvelope(bytes: Uint8Array): IdentityEnvelopeV1 {
  if (bytes.byteLength > IDENTITY_ARTIFACT_LIMITS.derivedEnvelopeBytes)
    throw new Error("IDENTITY_DERIVED_ENVELOPE_TOO_LARGE");
  let raw: unknown;
  try {
    raw = JSON.parse(utf8(bytes));
  } catch {
    throw new Error("IDENTITY_ENVELOPE_INVALID_JSON");
  }
  const e = object(raw, "IDENTITY_ENVELOPE_INVALID");
  exact(
    e,
    [
      "schemaVersion",
      "parserVersion",
      "upstreamRelease",
      "releaseCutoff",
      "sourceLockSha256",
      "components",
      "houseUniverse",
      "senateUniverse",
      "senatePolicy",
      "compiledFactsSha256",
      "rows",
    ],
    "IDENTITY_ENVELOPE_UNKNOWN_FIELD",
  );
  if (
    e.schemaVersion !== 1 ||
    typeof e.parserVersion !== "string" ||
    !e.parserVersion ||
    typeof e.upstreamRelease !== "string" ||
    !e.upstreamRelease ||
    typeof e.releaseCutoff !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(e.releaseCutoff) ||
    !validHash(e.sourceLockSha256) ||
    !Array.isArray(e.houseUniverse) ||
    !Array.isArray(e.senateUniverse) ||
    !validHash(e.compiledFactsSha256) ||
    !Array.isArray(e.rows)
  )
    throw new Error("IDENTITY_ENVELOPE_INVALID");
  const cs = object(e.components, "IDENTITY_ENVELOPE_INVALID"),
    p = object(e.senatePolicy, "IDENTITY_ENVELOPE_INVALID");
  exact(
    cs,
    ["house", "senate", "senateServiceStarts"],
    "IDENTITY_ENVELOPE_UNKNOWN_FIELD",
  );
  exact(p, ["noSenateJurisdictions"], "IDENTITY_ENVELOPE_UNKNOWN_FIELD");
  if (
    !Array.isArray(p.noSenateJurisdictions) ||
    !p.noSenateJurisdictions.every((x) => typeof x === "string")
  )
    throw new Error("IDENTITY_ENVELOPE_INVALID");
  const envelope: IdentityEnvelopeV1 = {
    schemaVersion: 1,
    parserVersion: e.parserVersion,
    upstreamRelease: e.upstreamRelease,
    releaseCutoff: e.releaseCutoff,
    sourceLockSha256: e.sourceLockSha256,
    components: {
      house: decodeComponent(
        cs.house,
        IDENTITY_ARTIFACT_LIMITS.houseBytes,
        "house-xml",
      ),
      senate: decodeComponent(
        cs.senate,
        IDENTITY_ARTIFACT_LIMITS.senateBytes,
        "senate-xml",
      ),
      senateServiceStarts: decodeComponent(
        cs.senateServiceStarts,
        IDENTITY_ARTIFACT_LIMITS.senateServiceStartsBytes,
        "senate-service-starts",
      ),
    },
    houseUniverse: e.houseUniverse as HouseSeat[],
    senateUniverse: e.senateUniverse as SenateSeat[],
    senatePolicy: { noSenateJurisdictions: p.noSenateJurisdictions },
    compiledFactsSha256: e.compiledFactsSha256,
    rows: e.rows as IdentityStageRow[],
  };
  const facts = replayIdentityFacts(envelope);
  if (
    compiledFactsSha256(envelope, facts) !== envelope.compiledFactsSha256 ||
    JSON.stringify(facts.map(stageRow)) !== JSON.stringify(envelope.rows)
  )
    throw new Error("IDENTITY_ENVELOPE_FACTS_MISMATCH");
  return envelope;
}
export function createIdentityAdapter(
  options: IdentityAdapterOptions,
): SourceAdapter<IdentityEnvelopeV1, IdentityStageRow> {
  if (
    !options.upstreamRelease ||
    !options.parserVersion ||
    !/^\d{4}-\d{2}-\d{2}$/.test(options.releaseCutoff) ||
    !validHash(options.sourceLockSha256)
  )
    throw new Error("IDENTITY_METADATA_REQUIRED");
  const base = {
    schemaVersion: 1 as const,
    parserVersion: options.parserVersion,
    upstreamRelease: options.upstreamRelease,
    releaseCutoff: options.releaseCutoff,
    sourceLockSha256: options.sourceLockSha256,
    components: {
      house: component(
        options.house,
        IDENTITY_ARTIFACT_LIMITS.houseBytes,
        "house-xml",
      ),
      senate: component(
        options.senate,
        IDENTITY_ARTIFACT_LIMITS.senateBytes,
        "senate-xml",
      ),
      senateServiceStarts: component(
        options.senateServiceStarts,
        IDENTITY_ARTIFACT_LIMITS.senateServiceStartsBytes,
        "senate-service-starts",
      ),
    },
    houseUniverse: [...options.houseUniverse],
    senateUniverse: [...options.senateUniverse],
    senatePolicy: {
      noSenateJurisdictions: [
        ...options.senatePolicy.noSenateJurisdictions,
      ].sort(bytewise),
    },
  };
  const facts = replayIdentityFacts(base);
  const value: IdentityEnvelopeV1 = {
    ...base,
    compiledFactsSha256: compiledFactsSha256(facts),
    rows: facts.map(stageRow),
  };
  const decoded = decodeIdentityEnvelope(encodeIdentityEnvelope(value)),
    bytes = encodeIdentityEnvelope(value),
    checksumSha256 = sha256(bytes),
    vacancies = decoded.rows.filter((x) => x.vacancy).length;
  return {
    sourceName: "identity",
    adapterVersion: options.parserVersion,
    async *extract(
      context: ExtractContext,
    ): AsyncIterable<RawObject<IdentityEnvelopeV1>> {
      abort(context.signal);
      const receipt = await options.rawStore.put({
        objectKey: `identity/${options.upstreamRelease}/${checksumSha256}.json`,
        body: await body(bytes),
        expectedSha256: checksumSha256,
        signal: context.signal,
      });
      yield {
        value: decoded,
        receipt,
        snapshot: {
          id: options.snapshotId,
          sourceUrl: `identity-envelope:${decoded.components.house.url}|${decoded.components.senate.url}|${decoded.components.senateServiceStarts.url}`,
          checksumSha256,
          upstreamRelease: options.upstreamRelease,
          publishedAt: null,
          license: "source-locked",
          usageStatus: "approved",
        },
        expectedRecordCount: 541,
      };
    },
    async *parse(raw) {
      for (const row of decodeIdentityEnvelope(
        encodeIdentityEnvelope(raw.value),
      ).rows)
        yield { kind: "row" as const, row };
    },
    naturalKey: (row) => row.sourceNaturalKey,
    async stage(client, runId, rows) {
      if (!rows.length) return;
      await client.query(
        "INSERT INTO stg_identity(run_id,release_id,source_natural_key,snapshot_id,entity_id,source_entity_id,display_name,office_chamber,office_state_code,office_district_code,redacted_extras) SELECT $1,ir.release_id,x.key,ir.snapshot_id,x.entity_id,x.source_entity_id,x.display_name,x.chamber,x.state_code,x.district_code,'{}'::jsonb FROM ingest_runs ir CROSS JOIN unnest($2::text[],$3::text[],$4::text[],$5::text[],$6::text[],$7::text[],$8::text[]) AS x(key,entity_id,source_entity_id,display_name,chamber,state_code,district_code) WHERE ir.id=$1",
        [
          runId,
          rows.map((x) => x.sourceNaturalKey),
          rows.map((x) => x.entityId),
          rows.map((x) => x.sourceEntityId),
          rows.map((x) => x.displayName),
          rows.map((x) => x.officeChamber),
          rows.map((x) => x.officeStateCode),
          rows.map((x) => x.officeDistrictCode),
        ],
      );
    },
    async validateStaged(client, runId): Promise<readonly ValidationIssue[]> {
      const r = (
        await client.query<{
          total: unknown;
          offices: unknown;
          house: unknown;
          senate: unknown;
          occupied: unknown;
          unique_people: unknown;
          vacancies: unknown;
        }>(
          "SELECT count(*) total,count(DISTINCT source_natural_key) offices,count(*) FILTER (WHERE office_chamber='house') house,count(*) FILTER (WHERE office_chamber='senate') senate,count(*) FILTER (WHERE entity_id NOT LIKE '__vacancy__:%') occupied,count(DISTINCT entity_id) FILTER (WHERE entity_id NOT LIKE '__vacancy__:%') unique_people,count(*) FILTER (WHERE entity_id LIKE '__vacancy__:%') vacancies FROM stg_identity WHERE run_id=$1",
          [runId],
        )
      ).rows[0];
      const n = (x: unknown) => Number(x);
      return r &&
        n(r.total) === 541 &&
        n(r.offices) === 541 &&
        n(r.house) === 441 &&
        n(r.senate) === 100 &&
        n(r.occupied) === 541 - vacancies &&
        n(r.occupied) === n(r.unique_people) &&
        n(r.vacancies) === vacancies
        ? []
        : [
            {
              code: "IDENTITY_STAGE_INVALID",
              message:
                "Identity staging must contain a complete unique nationwide office universe.",
            },
          ];
    },
    async loadFromStage(client, runId, releaseId) {
      if (!options.finalizeNationwide)
        throw new Error("NATIONWIDE_FINALIZE_REQUIRED");
      await options.finalizeNationwide(client, runId, releaseId);
    },
  };
}
