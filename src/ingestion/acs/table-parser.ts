import type { FactValue, MissingReason } from "@/domain/contracts";
import type { AcsIndicatorDefinition } from "./indicator-dictionary";

export class AcsTableParserError extends Error {
  constructor(readonly code: "ACS_HEADER_INVALID" | "ACS_ROW_WIDTH" | "ACS_GEOID_INVALID" | "ACS_GEOID_DUPLICATE" | "ACS_NUMERIC_INVALID" | "ACS_UNKNOWN_SENTINEL" | "ACS_TOO_MANY_DISTRICTS", message: string) { super(message); this.name = "AcsTableParserError"; }
}

export interface AcsTableRow {
  readonly sourceGeoid: string;
  readonly stateFips: string;
  readonly districtCode: string;
  readonly indicatorDefinitionId: AcsIndicatorDefinition["id"];
  readonly estimate: FactValue<number>;
  readonly marginOfError: FactValue<number>;
  readonly sourceNaturalKey: string;
}
export type AcsTableParseEvent =
  | { readonly kind: "row"; readonly row: AcsTableRow }
  | { readonly kind: "quarantine"; readonly lineNumber: number; readonly payload: Uint8Array; readonly errorCode: AcsTableParserError["code"] };

export type AcsTableInput = Uint8Array | AsyncIterable<Uint8Array>;
const districtGeoid = /^5001900US(\d{2})(\d{2})$/;
const pseudoDistrictGeoid = /^5001900US\d{2}ZZ$/;
const numeric = /^\d+(?:\.\d+)?$/;
const missingSentinels: Readonly<Record<string, MissingReason>> = Object.freeze({ "-888888888": "not_applicable", "-999999999": "suppressed", "-666666666": "not_reported", "-222222222": "not_reported", "-333333333": "not_reported" });

async function* chunks(input: AcsTableInput): AsyncIterable<Uint8Array> { if (ArrayBuffer.isView(input)) { yield input as Uint8Array; return; } yield* input; }

function value(raw: string, isMoe: boolean, key: string): FactValue<number> {
  if (raw === "") return { kind: "missing", reason: "not_reported" };
  if (isMoe && raw === "-555555555") return { kind: "missing", reason: "not_applicable" };
  const reason = missingSentinels[raw];
  if (reason) return { kind: "missing", reason };
  if (raw.startsWith("-")) throw new AcsTableParserError("ACS_UNKNOWN_SENTINEL", `Unknown ACS sentinel at ${key}`);
  if (!numeric.test(raw)) throw new AcsTableParserError("ACS_NUMERIC_INVALID", `Malformed ACS numeric value at ${key}`);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || Math.abs(parsed) > Number.MAX_SAFE_INTEGER) throw new AcsTableParserError("ACS_NUMERIC_INVALID", `Unsafe ACS numeric value at ${key}`);
  return { kind: "value", value: parsed };
}

/** Parses a pipe-delimited official table without retaining non-CD source rows. */
export async function parseAcsSummaryTable(input: AcsTableInput, definition: AcsIndicatorDefinition): Promise<readonly AcsTableRow[]> {
  const rows: AcsTableRow[] = [];
  for await (const event of parseAcsSummaryTableIncrementally(input, definition)) {
    if (event.kind === "quarantine") throw new AcsTableParserError(event.errorCode, "Invalid congressional-district source row");
    rows.push(event.row);
  }
  return rows.sort((left, right) => left.sourceGeoid < right.sourceGeoid ? -1 : left.sourceGeoid > right.sourceGeoid ? 1 : 0);
}

/** Incremental parser: source-wide structure errors throw; bad CD rows are isolated. */
export async function* parseAcsSummaryTableIncrementally(input: AcsTableInput, definition: AcsIndicatorDefinition): AsyncIterable<AcsTableParseEvent> {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const encoder = new TextEncoder();
  let remainder = "", header: string[] | undefined, lineNumber = 0;
  const retained = new Set<string>();
  const process = (line: string): AcsTableParseEvent | undefined => {
    lineNumber++;
    if (line.endsWith("\r")) line = line.slice(0, -1);
    if (!header) {
      header = line.split("|");
      const required = ["GEO_ID", ...definition.sourceColumns];
      if (header.length !== required.length || header.some((column, index) => column !== required[index])) throw new AcsTableParserError("ACS_HEADER_INVALID", "ACS table header does not match the locked direct-table schema");
      return undefined;
    }
    const fields = line.split("|");
    const quarantine = (errorCode: AcsTableParserError["code"]): AcsTableParseEvent => ({ kind: "quarantine", lineNumber, payload: encoder.encode(line), errorCode });
    if (fields.length !== header.length) return quarantine("ACS_ROW_WIDTH");
    const geoId = fields[header.indexOf("GEO_ID")]!;
    const match = districtGeoid.exec(geoId);
    if (!match) { if (pseudoDistrictGeoid.test(geoId)) return undefined; if (geoId.startsWith("5001900US")) return quarantine("ACS_GEOID_INVALID"); return undefined; }
    if (retained.has(geoId)) throw new AcsTableParserError("ACS_GEOID_DUPLICATE", `Duplicate congressional-district GEO_ID: ${geoId}`);
    if (retained.size >= 500) throw new AcsTableParserError("ACS_TOO_MANY_DISTRICTS", "Too many congressional-district rows");
    const key = `${definition.id}:${geoId}`;
    try {
      const row = { sourceGeoid: geoId, stateFips: match[1]!, districtCode: match[2]!, indicatorDefinitionId: definition.id, estimate: value(fields[header.indexOf(definition.estimateColumn)]!, false, key), marginOfError: value(fields[header.indexOf(definition.marginOfErrorColumn)]!, true, key), sourceNaturalKey: key };
      retained.add(geoId);
      return { kind: "row", row };
    } catch (error) {
      if (error instanceof AcsTableParserError) return quarantine(error.code);
      throw error;
    }
  };
  for await (const chunk of chunks(input)) {
    remainder += decoder.decode(chunk, { stream: true });
    let newline: number;
    while ((newline = remainder.indexOf("\n")) >= 0) { const event = process(remainder.slice(0, newline)); if (event) yield event; remainder = remainder.slice(newline + 1); }
  }
  remainder += decoder.decode();
  if (remainder !== "") { const event = process(remainder); if (event) yield event; }
  if (!header) throw new AcsTableParserError("ACS_HEADER_INVALID", "ACS table is empty");
}
