import { z } from "zod";

export const CENSUS_GEOCODER_ENDPOINT = "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress";
export const CENSUS_GEOCODER_DOCUMENTATION_URL = "https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html";
export const CENSUS_BENCHMARK = { id: "8", name: "Public_AR_ACS2025" } as const;
export const CENSUS_VINTAGE = { id: "825", name: "ACS2025_ACS2025" } as const;
export const CENSUS_LAYERS = ["States", "119th Congressional Districts"] as const;
const endpointUrl = new URL(CENSUS_GEOCODER_ENDPOINT);
const CONGRESSIONAL_LAYER = CENSUS_LAYERS[1];
const MAX_BODY_BYTES = 1024 * 1024;
const numberOrString = z.union([z.string(), z.number()]).transform(String);
const coordinate = z.number().finite();
const responseSchema = z.object({
  result: z.object({
    input: z.object({
      benchmark: z.object({ id: numberOrString, benchmarkName: z.string() }).passthrough(),
      vintage: z.object({ id: numberOrString, vintageName: z.string() }).passthrough(),
    }).passthrough(),
    addressMatches: z.array(z.object({
      coordinates: z.object({ x: coordinate.gte(-180).lte(180), y: coordinate.gte(-90).lte(90) }),
      geographies: z.record(z.string(), z.array(z.object({ GEOID: z.string() }).passthrough())).optional(),
    }).passthrough()),
  }).passthrough(),
});

export interface CensusMetadata { id: string; name: string }
export interface CensusCandidate { longitude: number; latitude: number; stateGeoid: string | null; congressionalDistrictGeoid: string | null }
export interface CensusGeocodeResult { benchmark: CensusMetadata; vintage: CensusMetadata; candidates: CensusCandidate[] }
export interface CensusGeocoder { geocode(address: string, signal?: AbortSignal): Promise<CensusGeocodeResult> }
export interface CensusGeocoderOptions {
  timeoutMs: number;
  fetch?: typeof fetch;
}

export class CallerAbortError extends Error {
  constructor() { super("Address lookup aborted"); this.name = "AbortError"; }
}
export function throwIfCallerAborted(signal?: AbortSignal): void { if (signal?.aborted) throw new CallerAbortError(); }
export function isCallerAbort(error: unknown, signal?: AbortSignal): boolean { return error instanceof CallerAbortError || signal?.aborted === true; }

/** Deliberately discards Census echo fields and always reports finite, non-sensitive errors. */
export class CensusGeocoderAdapter implements CensusGeocoder {
  private readonly fetcher: typeof fetch;
  constructor(private readonly options: CensusGeocoderOptions) {
    if (!Number.isInteger(options.timeoutMs) || options.timeoutMs <= 0) throw new Error("Invalid Census timeout");
    this.fetcher = options.fetch ?? fetch;
  }
  async geocode(address: string, callerSignal?: AbortSignal): Promise<CensusGeocodeResult> {
    throwIfCallerAborted(callerSignal);
    const url = new URL(CENSUS_GEOCODER_ENDPOINT);
    url.searchParams.set("address", address);
    url.searchParams.set("benchmark", CENSUS_BENCHMARK.name);
    url.searchParams.set("vintage", CENSUS_VINTAGE.name);
    url.searchParams.set("format", "json");
    url.searchParams.set("layers", CENSUS_LAYERS.join(","));
    const timeout = AbortSignal.timeout(this.options.timeoutMs);
    const signal = callerSignal ? AbortSignal.any([callerSignal, timeout]) : timeout;
    let response: Response;
    try { response = await this.fetcher(url, { method: "GET", redirect: "error", cache: "no-store", headers: { Accept: "application/json", "Cache-Control": "no-store" }, signal }); }
    catch (error) { if (isCallerAbort(error, callerSignal)) throw new CallerAbortError(); throw new Error("Census geocoder request failed"); }
    if (response.redirected || (() => { const actual = new URL(response.url); return actual.origin !== endpointUrl.origin || actual.pathname !== endpointUrl.pathname; })()) throw new Error("Census geocoder protocol failure");
    if (!response.ok) throw new Error("Census geocoder unavailable");
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")) throw new Error("Census geocoder protocol failure");
    let parsed: z.infer<typeof responseSchema>;
    try {
      const reader = response.body?.getReader(); if (!reader) throw new Error("missing body");
      let size = 0; const chunks: Uint8Array[] = [];
      while (true) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > MAX_BODY_BYTES) { void reader.cancel().catch(() => undefined); throw new Error("too large"); } chunks.push(next.value); }
      const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      parsed = responseSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
    } catch { throw new Error("Census geocoder protocol failure"); }
    const benchmark = { id: parsed.result.input.benchmark.id, name: parsed.result.input.benchmark.benchmarkName };
    const vintage = { id: parsed.result.input.vintage.id, name: parsed.result.input.vintage.vintageName };
    if (benchmark.id !== CENSUS_BENCHMARK.id || benchmark.name !== CENSUS_BENCHMARK.name || vintage.id !== CENSUS_VINTAGE.id || vintage.name !== CENSUS_VINTAGE.name) throw new Error("Census geocoder metadata mismatch");
    return { benchmark, vintage, candidates: parsed.result.addressMatches.map((match) => {
      const { x: longitude, y: latitude } = match.coordinates;
      const ids = (name: string) => match.geographies?.[name]?.map((item) => item.GEOID) ?? [];
      const exactlyOne = (name: string) => { const values = ids(name); return values.length === 1 ? values[0]! : null; };
      return { longitude, latitude, stateGeoid: exactlyOne("States"), congressionalDistrictGeoid: exactlyOne(CONGRESSIONAL_LAYER) };
    }) };
  }
}
