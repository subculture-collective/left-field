import { z } from "zod";

const endpoint = "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress";
const endpointUrl = new URL(endpoint);
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
  benchmark: CensusMetadata;
  vintage: CensusMetadata;
  congressionalLayerName: string;
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
    const url = new URL(endpoint);
    url.searchParams.set("address", address);
    url.searchParams.set("benchmark", "Public_AR_Current");
    url.searchParams.set("vintage", "Current_Current");
    url.searchParams.set("format", "json");
    url.searchParams.set("layers", `States,${this.options.congressionalLayerName}`);
    const timeout = AbortSignal.timeout(this.options.timeoutMs);
    const signal = callerSignal ? AbortSignal.any([callerSignal, timeout]) : timeout;
    let response: Response;
    try { response = await this.fetcher(url, { method: "GET", redirect: "error", cache: "no-store", headers: { Accept: "application/json" }, signal }); }
    catch (error) { if (isCallerAbort(error, callerSignal)) throw new CallerAbortError(); throw new Error("Census geocoder request failed"); }
    if (response.redirected || (() => { const actual = new URL(response.url); return actual.origin !== endpointUrl.origin || actual.pathname !== endpointUrl.pathname; })()) throw new Error("Census geocoder protocol failure");
    if (!response.ok) throw new Error("Census geocoder unavailable");
    let parsed: z.infer<typeof responseSchema>;
    try { parsed = responseSchema.parse(await response.json()); } catch { throw new Error("Census geocoder protocol failure"); }
    const benchmark = { id: parsed.result.input.benchmark.id, name: parsed.result.input.benchmark.benchmarkName };
    const vintage = { id: parsed.result.input.vintage.id, name: parsed.result.input.vintage.vintageName };
    if (benchmark.id !== this.options.benchmark.id || benchmark.name !== this.options.benchmark.name || vintage.id !== this.options.vintage.id || vintage.name !== this.options.vintage.name) throw new Error("Census geocoder metadata mismatch");
    return { benchmark, vintage, candidates: parsed.result.addressMatches.map((match) => {
      const { x: longitude, y: latitude } = match.coordinates;
      const ids = (name: string) => match.geographies?.[name]?.map((item) => item.GEOID) ?? [];
      const exactlyOne = (name: string) => { const values = ids(name); return values.length === 1 ? values[0]! : null; };
      return { longitude, latitude, stateGeoid: exactlyOne("States"), congressionalDistrictGeoid: exactlyOne(this.options.congressionalLayerName) };
    }) };
  }
}
