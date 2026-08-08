/** Additive, file-backed contract for fast, source-bound election acquisition. */
export const RAPID_ACQUISITION_SCHEMA = "rapid-acquisition-v1" as const;

export type SourceAuthority = "official_direct" | "official_derived" | "research_fallback";
export type GeographyLevel = "county" | "state_leg_district" | "house_district";
export type ElectionType = "primary" | "general" | "runoff" | "special" | "other";
export type GovernmentLevel = "federal" | "state" | "county" | "municipal" | "special_district";
export type OfficeFamily = "legislature" | "executive" | "commission" | "prosecutor" | "sheriff" | "judicial" | "other";
export type ElectionMethod = "partisan_plurality" | "nonpartisan_plurality" | "ranked_choice" | "top_two" | "multi_member" | "unknown";
export type ResultStatus = "certified" | "official_reported" | "unofficial" | "not_collected";
export type WinnerStatus = "source_marked_winner" | "not_marked_by_source" | "not_applicable";
export type MissingReason = "not_collected" | "not_reported" | "authority_unavailable" | "incompatible_reporting_unit" | "not_applicable";
/** Count metrics are nonnegative integers; density/income are nonnegative values; share metrics are proportions in [0,1]. */
export type CountyMetricName = "active_registration" | "ballots_cast" | "cvap" | "renter_share" | "age_18_34_share" | "median_household_income" | "population_density" | "federal_democratic_share";

export type FactValue = Readonly<{ kind: "value"; value: number }> | Readonly<{ kind: "missing"; reason: MissingReason }>;
export type FormulaEligibility = "eligible" | "catalog_only" | "formula_ineligible";

export interface RapidSource {
  readonly lockId: string;
  readonly authority: SourceAuthority;
  readonly parserVersion: string;
  readonly retrievedAt: string;
}

export interface RapidJurisdiction {
  readonly id: string;
  readonly level: GeographyLevel;
  readonly stateCode: string;
  readonly countyFips?: string;
  readonly sourceIdentifiers: Readonly<Record<string, string>>;
}

export interface RapidContest {
  readonly id: string;
  readonly sourceNaturalKey: string;
  readonly authoritativeSourceLockId: string;
  readonly jurisdictionId: string;
  readonly sourceLockIds: readonly string[];
  readonly electionDate: string;
  readonly electionGeographyVintage: string;
  readonly electionType: ElectionType;
  readonly governmentLevel: GovernmentLevel;
  readonly officeFamily: OfficeFamily;
  readonly sourceOfficeTitle: string;
  readonly normalizedOfficeTitle: string;
  readonly electionMethod: ElectionMethod;
  readonly districtMagnitude: number;
  readonly resultStatus: ResultStatus;
}

export interface RapidCandidateResult {
  readonly contestId: string;
  readonly sourceCandidateKey: string;
  readonly sourceCandidateName: string;
  readonly party: string | null;
  readonly votes: number;
  readonly winnerStatus: WinnerStatus;
  readonly sourceLockIds: readonly string[];
}

export interface CountyMetric {
  readonly countyFips: string;
  readonly metric: CountyMetricName;
  readonly value: FactValue;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly reportingUnitDefinition: "county-equivalent" | "other_administrative_unit";
  readonly sourceLockIds: readonly string[];
}

export interface OfficeCatalogRecord {
  readonly id: string;
  readonly jurisdictionId: string;
  readonly sourceLockIds: readonly string[];
  readonly governmentLevel: GovernmentLevel;
  readonly officeFamily: OfficeFamily;
  readonly sourceOfficeTitle: string;
  readonly normalizedOfficeTitle: string;
  readonly electionMethod: ElectionMethod;
  readonly districtMagnitude: number;
  readonly currentStatus: "occupied" | "open" | "unknown";
  readonly currentStatusConfidence: SourceAuthority;
  readonly currentStatusSourceLockIds: readonly string[];
  readonly formulaEligibility: FormulaEligibility;
}

export interface RapidDatasetInput {
  readonly schema: typeof RAPID_ACQUISITION_SCHEMA;
  readonly version: 1;
  readonly sourceLockSha256: string;
  readonly sources: readonly RapidSource[];
  readonly jurisdictions: readonly RapidJurisdiction[];
  readonly contests: readonly RapidContest[];
  readonly candidateResults: readonly RapidCandidateResult[];
  readonly countyMetrics: readonly CountyMetric[];
  readonly officeCatalog: readonly OfficeCatalogRecord[];
}

export interface RapidDataset extends RapidDatasetInput {
  readonly datasetSha256: string;
  readonly counts: Readonly<{ jurisdictions: number; contests: number; candidateResults: number; countyMetrics: number; officeCatalog: number }>;
}

/** Minimal portion of the checked-in source lock required by this additive reader. */
export interface RapidSourceLockDocument {
  readonly version: 1;
  readonly entries: readonly Readonly<{ id: string }> [];
}

export type ReportingUnitJoin =
  | Readonly<{ kind: "county_wholly_in_house_district"; countyFips: string; houseDistrict: string; resultGeographyVintage: string; houseGeographyVintage: string; evidenceSourceLockIds: readonly string[] }>
  | Readonly<{ kind: "reporting_unit_with_house_district"; reportingUnitKey: string; houseDistrict: string; resultGeographyVintage: string; houseGeographyVintage: string; evidenceSourceLockIds: readonly string[] }>
  | Readonly<{ kind: "at_large_statewide"; stateCode: string; houseDistrict: string; resultGeographyVintage: string; houseGeographyVintage: string; countyUniverse: Readonly<{ status: "closed"; countyFips: readonly string[]; evidenceSourceLockIds: readonly string[] }> }>
  | Readonly<{ kind: "split_county_without_house_district"; countyFips: string }>;

export interface ReportingUnitJoinContext {
  readonly sourceLockIds: readonly string[];
  readonly expectedCountyFipsByState: Readonly<Record<string, Readonly<{ countyFips: readonly string[]; evidenceSourceLockIds: readonly string[] }>>>;
}
