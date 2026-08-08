import { readFileSync } from "node:fs";
import { join } from "node:path";

const STATES = ["AL", "DE", "HI", "IN", "KS", "KY", "LA", "MO", "MS", "NH", "NV", "RI", "SC", "TN", "VT", "WI"] as const;
const CYCLES = [2022, 2024, 2026] as const;
const CLOSURES = ["future_event", "not_held", "authority_unavailable", "source_blocked"] as const;
const STATUSES = ["acquisition_ready", "not_yet_available", "not_applicable", "source_blocked"] as const;
const FORMATS = ["state_results_portal", "html_results_index", "csv_download", "decentralized_county_results"] as const;
const TARGET_DISTRICTS = {
  AL: ["AL-02", "AL-07"], DE: ["DE-AL"], HI: ["HI-01", "HI-02"], IN: ["IN-01", "IN-07"], KS: ["KS-03"], KY: ["KY-03"], LA: ["LA-02", "LA-06"], MO: ["MO-01", "MO-05"], MS: ["MS-02"], NH: ["NH-01", "NH-02"], NV: ["NV-01", "NV-03", "NV-04"], RI: ["RI-01", "RI-02"], SC: ["SC-06"], TN: ["TN-09"], VT: ["VT-AL"], WI: ["WI-02", "WI-04"],
} as const;

export type HousePrimaryRegistryState = typeof STATES[number];
export type HousePrimaryFinalClosure = typeof CLOSURES[number];
export type HousePrimarySourceFormat = typeof FORMATS[number];
export interface HousePrimaryArtifact { readonly sourceId: string; readonly authority: string; readonly url: string; readonly outputPath: string; readonly format: HousePrimarySourceFormat; readonly expectedBytes?: number; readonly expectedSha256?: string; readonly allowedFinalUrl?: string; }
export interface HousePrimaryRegistryRow {
  readonly stateCode: HousePrimaryRegistryState; readonly cycleYear: typeof CYCLES[number]; readonly electionDate: string;
  readonly acquisitionStatus: typeof STATUSES[number]; readonly finalClosure: HousePrimaryFinalClosure | null;
  readonly targetDistricts: readonly string[]; readonly districtAvailability: Readonly<Record<string, HousePrimaryFinalClosure | null>>;
  readonly artifacts: readonly HousePrimaryArtifact[];
}
export interface HousePrimarySourceRegistry { readonly schema: "house-primary-source-registry-v1"; readonly version: 1; readonly asOf: string; readonly rows: readonly HousePrimaryRegistryRow[]; }

type ExpectedArtifact = Omit<HousePrimaryArtifact, "allowedFinalUrl">;
const ARTIFACTS: Record<string, readonly ExpectedArtifact[]> = {
  "DE-2022": [{ sourceId: "de-2022-primary-results", url: "https://elections.delaware.gov/reports/PR2022.csv", outputPath: "house-primary/de/2022/primary-results.csv", format: "csv_download", authority: "Delaware Department of Elections" }], "DE-2024": [{ sourceId: "de-2024-primary-results", url: "https://elections.delaware.gov/reports/PR2024.csv", outputPath: "house-primary/de/2024/primary-results.csv", format: "csv_download", authority: "Delaware Department of Elections" }],
  "HI-2022": [{ sourceId: "hi-2022-primary-summary", url: "https://files.hawaii.gov/elections/files/results/2022/primary/summary.txt", outputPath: "house-primary/hi/2022/summary.txt", format: "html_results_index", authority: "Hawaii Office of Elections" }], "HI-2024": [{ sourceId: "hi-2024-primary-summary", url: "https://files.hawaii.gov/elections/files/results/2024/Primary/summary.txt", outputPath: "house-primary/hi/2024/summary.txt", format: "html_results_index", authority: "Hawaii Office of Elections" }],
  "IN-2022": [{ sourceId: "in-2022-primary-settings", url: "https://enr.indianavoters.in.gov/archive/2022Primary/data/settings.json", outputPath: "house-primary/in/2022/settings.json", format: "state_results_portal", authority: "Indiana Secretary of State" }], "IN-2024": [{ sourceId: "in-2024-primary-settings", url: "https://enr.indianavoters.in.gov/archive/2024Primary/data/settings.json", outputPath: "house-primary/in/2024/settings.json", format: "state_results_portal", authority: "Indiana Secretary of State" }],
  "KS-2022": [{ sourceId: "ks-2022-primary-us-house-precinct-results", url: "https://sos.ks.gov/elections/22elec/2022-Primary-Election-US-House-of-Representatives-Results-By-Precinct.xlsx", outputPath: "house-primary/ks/2022/us-house-precinct-results.xlsx", format: "csv_download", authority: "Kansas Secretary of State" }], "KS-2024": [{ sourceId: "ks-2024-primary-us-house-precinct-results", url: "https://sos.ks.gov/elections/24elec/2024-Primary-Election-United-States-House-of-Representatives-Precinct%20Results.xlsx", outputPath: "house-primary/ks/2024/us-house-precinct-results.xlsx", format: "csv_download", authority: "Kansas Secretary of State" }],
  "KY-2024": [{ sourceId: "ky-2024-primary-results", url: "https://elect.ky.gov/results/2020-2029/Documents/2024%20Primary%20Results.pdf", outputPath: "house-primary/ky/2024/primary-results.pdf", format: "html_results_index", authority: "Kentucky State Board of Elections" }], "MO-2024": [{ sourceId: "mo-2024-primary-results", url: "https://www.sos.mo.gov/CMSImages/ElectionResultsStatistics/ActualResults-August62024.pdf", outputPath: "house-primary/mo/2024/primary-results.pdf", format: "html_results_index", authority: "Missouri Secretary of State" }], "MS-2024": [{ sourceId: "ms-2024-primary-results", url: "https://www.sos.ms.gov/elections/electionResults/2024DemocraticPrimary.asp", outputPath: "house-primary/ms/2024/primary-results.html", format: "html_results_index", authority: "Mississippi Secretary of State" }], "NH-2024": [{ sourceId: "nh-2024-primary-results", url: "https://www.sos.nh.gov/2024-state-primary-election-results", outputPath: "house-primary/nh/2024/primary-results.html", format: "html_results_index", authority: "New Hampshire Secretary of State" }],
  "RI-2022": [{ sourceId: "ri-2022-statewide-primary", url: "https://rigov.s3.amazonaws.com/election/results/2022/statewide_primary/statewide.json", outputPath: "house-primary/ri/2022/statewide.json", format: "state_results_portal", authority: "Rhode Island Board of Elections" }], "RI-2024": [{ sourceId: "ri-2024-statewide-primary", url: "https://rigov.s3.amazonaws.com/election/results/2024/statewide_primary/statewide.json", outputPath: "house-primary/ri/2024/statewide.json", format: "state_results_portal", authority: "Rhode Island Board of Elections" }], "SC-2022": [{ sourceId: "sc-2022-primary-enr", url: "https://www.enr-scvotes.org/SC/114143/Web02-state.289375/", outputPath: "house-primary/sc/2022/enr.html", format: "html_results_index", authority: "South Carolina Election Commission" }], "SC-2024": [{ sourceId: "sc-2024-primary-enr", url: "https://www.enr-scvotes.org/SC/121614/web.317647/", outputPath: "house-primary/sc/2024/enr.html", format: "html_results_index", authority: "South Carolina Election Commission" }],
};

const text = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const date = (value: unknown): value is string => text(value) && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
const oneOf = (value: unknown, values: readonly string[]) => values.includes(String(value));
const validUrl = (value: unknown) => { try { const url = new URL(String(value)); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; } };
const exactKeys = (value: object, keys: readonly string[]) => Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");
const PINS: Record<string, Readonly<{ expectedBytes: number; expectedSha256: string }>> = {"de-2022-primary-results":{expectedBytes:9152,expectedSha256:"ae008cbe1f02869bea1bea16e19949374db00a6f3035405f8cddd51c38b56441"},"de-2024-primary-results":{expectedBytes:14708,expectedSha256:"c583742e052f5cb5237886308a04d85e3bbb56ffef1b73ff55b1952c0d1496f2"},"hi-2022-primary-summary":{expectedBytes:109758,expectedSha256:"26e5a0d6ab3c5ca94be40de9218f43eb9f2973acb0361d08ff8a957dec3819da"},"hi-2024-primary-summary":{expectedBytes:77898,expectedSha256:"e5a0f37a2f5a3c6d29b48d76375f901b8926a8c907ad3d3d1ffb4c893a943915"},"in-2022-primary-settings":{expectedBytes:2233,expectedSha256:"de8fe508d6a8ede457ecb37cdb98d44c53c377f5548abdc5eb8171425729499e"},"in-2024-primary-settings":{expectedBytes:3028,expectedSha256:"430de937a82b87f5320a5047d37877f44612f824e3fc3696d650bbcfc61692cb"},"ks-2022-primary-us-house-precinct-results":{expectedBytes:300587,expectedSha256:"dc7d3f65012fb13ca4a045f2931529deee7d6351b584f4cf86c42db316dd0319"},"ks-2024-primary-us-house-precinct-results":{expectedBytes:487805,expectedSha256:"8ada8f05d50714e42baa14314ed94fbf4d9c228165e350309a1f3e8717c66c73"},"ky-2024-primary-results":{expectedBytes:211411,expectedSha256:"9308e1c41742ab18cd8b9a28b0b6fc3d2318515a1ce9f4eec7b869b3d01f39d8"},"mo-2024-primary-results":{expectedBytes:1763712,expectedSha256:"c3cbf17b8598920730c77e58b97be404d2a015573ff876952eb025681577cb54"},"ms-2024-primary-results":{expectedBytes:22695,expectedSha256:"73d36cc3d47095e7378db4414d239fb9f84c3e1a9a48bfe3cc48b758b996796f"},"nh-2024-primary-results":{expectedBytes:2946836,expectedSha256:"8ac5ea94a2ae2c66950c5781c6e00157327a278dcd2855ed238d1955906c0ba2"},"ri-2022-statewide-primary":{expectedBytes:5707,expectedSha256:"047292a55e15f581273b02fce6f831c81f219c992772ba6f8eb4e87f3e8a4118"},"ri-2024-statewide-primary":{expectedBytes:2256,expectedSha256:"52fde84daf1d09b91822cec3908d97b3288af3f06f5a5cb6cfd2a40adb010461"},"sc-2022-primary-enr":{expectedBytes:10707,expectedSha256:"b8894fe3240338e26f075ebc968dfd1c829779b34594a05d5171cff755db3527"},"sc-2024-primary-enr":{expectedBytes:1560,expectedSha256:"cad527403e366e5915c719ae5ac4001514cf269a216b1f575cdf7127c526a9ea"}};
const sameArtifact = (actual: HousePrimaryArtifact, expected: ExpectedArtifact) => actual.sourceId === expected.sourceId && actual.authority === expected.authority && actual.url === expected.url && actual.outputPath === expected.outputPath && actual.format === expected.format && actual.expectedBytes === PINS[actual.sourceId]?.expectedBytes && actual.expectedSha256 === PINS[actual.sourceId]?.expectedSha256 && actual.allowedFinalUrl === undefined;

export function validateHousePrimarySourceRegistry(value: unknown): HousePrimarySourceRegistry {
  if (!value || typeof value !== "object" || Array.isArray(value) || !exactKeys(value, ["schema", "version", "asOf", "rows"])) throw new Error("HOUSE_PRIMARY_REGISTRY_INVALID");
  const root = value as { schema?: unknown; version?: unknown; asOf?: unknown; rows?: unknown };
  if (root.schema !== "house-primary-source-registry-v1" || root.version !== 1 || !date(root.asOf) || !Array.isArray(root.rows) || root.rows.length !== STATES.length * CYCLES.length) throw new Error("HOUSE_PRIMARY_REGISTRY_INVALID");
  const asOf = root.asOf;
  const seenRows = new Set<string>(), seenSourceIds = new Set<string>(), seenOutputPaths = new Set<string>();
  const rows: HousePrimaryRegistryRow[] = root.rows.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || !exactKeys(raw, ["stateCode", "cycleYear", "electionDate", "acquisitionStatus", "finalClosure", "districtAvailability", "artifacts"])) throw new Error("HOUSE_PRIMARY_REGISTRY_ROW_INVALID");
    const row = raw as Record<string, unknown>, stateCode = row.stateCode;
    if (!oneOf(stateCode, STATES) || !CYCLES.includes(row.cycleYear as never) || !date(row.electionDate) || !oneOf(row.acquisitionStatus, STATUSES) || (row.finalClosure !== null && !oneOf(row.finalClosure, CLOSURES))) throw new Error("HOUSE_PRIMARY_REGISTRY_ROW_INVALID");
    const state = stateCode as HousePrimaryRegistryState, cycle = row.cycleYear as typeof CYCLES[number], key = `${state}-${cycle}`;
    if (seenRows.has(key)) throw new Error("HOUSE_PRIMARY_REGISTRY_DUPLICATE_ROW"); seenRows.add(key);
    const targetDistricts = TARGET_DISTRICTS[state];
    if (!row.districtAvailability || typeof row.districtAvailability !== "object" || Array.isArray(row.districtAvailability) || !exactKeys(row.districtAvailability as object, targetDistricts)) throw new Error("HOUSE_PRIMARY_REGISTRY_DISTRICT_INVALID");
    const districtAvailability = row.districtAvailability as Record<string, unknown>;
    if (Object.values(districtAvailability).some((closure) => closure !== null && !oneOf(closure, CLOSURES)) || !Object.values(districtAvailability).every((closure) => closure === row.finalClosure)) throw new Error("HOUSE_PRIMARY_REGISTRY_DISTRICT_INVALID");
    if (!Array.isArray(row.artifacts)) throw new Error("HOUSE_PRIMARY_REGISTRY_ARTIFACT_INVALID");
    const artifacts = row.artifacts.map((rawArtifact) => {
      if (!rawArtifact || typeof rawArtifact !== "object" || Array.isArray(rawArtifact)) throw new Error("HOUSE_PRIMARY_REGISTRY_ARTIFACT_INVALID");
      const artifact = rawArtifact as Record<string, unknown>, hasAllowedFinalUrl = artifact.allowedFinalUrl !== undefined;
      const pin = PINS[String(artifact.sourceId)];
      if (!exactKeys(artifact, hasAllowedFinalUrl ? ["sourceId", "authority", "url", "outputPath", "format", "expectedBytes", "expectedSha256", "allowedFinalUrl"] : ["sourceId", "authority", "url", "outputPath", "format", "expectedBytes", "expectedSha256"]) || !text(artifact.sourceId) || !/^[a-z0-9][a-z0-9._-]*$/.test(artifact.sourceId) || !text(artifact.authority) || !validUrl(artifact.url) || !text(artifact.outputPath) || !artifact.outputPath.startsWith(`house-primary/${state.toLowerCase()}/${cycle}/`) || artifact.outputPath.startsWith("/") || artifact.outputPath.split("/").includes("..") || !oneOf(artifact.format, FORMATS) || !Number.isSafeInteger(artifact.expectedBytes) || Number(artifact.expectedBytes) < 0 || !/^[a-f0-9]{64}$/.test(String(artifact.expectedSha256)) || (hasAllowedFinalUrl && !validUrl(artifact.allowedFinalUrl))) throw new Error("HOUSE_PRIMARY_REGISTRY_ARTIFACT_INVALID");
      if (seenSourceIds.has(artifact.sourceId) || seenOutputPaths.has(artifact.outputPath)) throw new Error("HOUSE_PRIMARY_REGISTRY_ARTIFACT_DUPLICATE");
      seenSourceIds.add(artifact.sourceId); seenOutputPaths.add(artifact.outputPath);
      return { sourceId: artifact.sourceId, authority: artifact.authority, url: artifact.url as string, outputPath: artifact.outputPath, format: artifact.format as HousePrimarySourceFormat, ...(pin ? pin : {}), ...(hasAllowedFinalUrl ? { allowedFinalUrl: artifact.allowedFinalUrl as string } : {}) };
    });
    const expectedArtifacts = ARTIFACTS[key] ?? [];
    if (artifacts.length !== expectedArtifacts.length || artifacts.some((artifact, index) => !sameArtifact(artifact, expectedArtifacts[index]!))) throw new Error("HOUSE_PRIMARY_REGISTRY_ARTIFACT_POLICY_INVALID");
    const finalClosure = row.finalClosure as HousePrimaryFinalClosure | null;
    const expectedStatus = finalClosure === null ? "acquisition_ready" : finalClosure === "future_event" ? "not_yet_available" : finalClosure === "not_held" ? "not_applicable" : "source_blocked";
    if (row.acquisitionStatus !== expectedStatus || (finalClosure === null) !== (artifacts.length > 0) || (finalClosure !== null && artifacts.length > 0)) throw new Error("HOUSE_PRIMARY_REGISTRY_STATUS_POLICY_INVALID");
    if (state === "LA" && finalClosure !== "not_held") throw new Error("HOUSE_PRIMARY_REGISTRY_LOUISIANA_POLICY_INVALID");
    if (state === "WI" && finalClosure === null) throw new Error("HOUSE_PRIMARY_REGISTRY_WISCONSIN_POLICY_INVALID");
    if ((row.electionDate as string) > asOf && finalClosure !== "future_event" && finalClosure !== "not_held") throw new Error("HOUSE_PRIMARY_REGISTRY_FUTURE_POLICY_INVALID");
    return { stateCode: state, cycleYear: cycle, electionDate: row.electionDate as string, acquisitionStatus: row.acquisitionStatus as HousePrimaryRegistryRow["acquisitionStatus"], finalClosure, targetDistricts: [...targetDistricts], districtAvailability: districtAvailability as Record<string, HousePrimaryFinalClosure | null>, artifacts };
  });
  if (seenRows.size !== STATES.length * CYCLES.length || STATES.some((state) => CYCLES.some((cycle) => !seenRows.has(`${state}-${cycle}`)))) throw new Error("HOUSE_PRIMARY_REGISTRY_COVERAGE_INVALID");
  return { schema: "house-primary-source-registry-v1", version: 1, asOf, rows: rows.sort((left, right) => left.stateCode.localeCompare(right.stateCode) || left.cycleYear - right.cycleYear) };
}

let cached: HousePrimarySourceRegistry | undefined;
export function housePrimarySourceRegistry(): HousePrimarySourceRegistry {
  if (!cached) cached = validateHousePrimarySourceRegistry(JSON.parse(readFileSync(join(process.cwd(), "data/rapid-acquisition/house-primary-source-registry-v1.json"), "utf8")));
  return cached;
}
