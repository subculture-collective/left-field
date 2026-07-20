/** The complete, direct-source ACS surface authorized for this release. */
export interface AcsIndicatorDefinition {
  readonly id: "acs-total-population" | "acs-median-age" | "acs-median-household-income";
  readonly lockId: "acs-b01003" | "acs-b01002" | "acs-b19013";
  readonly sourceUrl: string;
  readonly surveyPeriod: "2020-2024";
  readonly label: string;
  readonly variableId: "B01003_001E" | "B01002_001E" | "B19013_001E";
  readonly unit: "count" | "years" | "usd";
  readonly universe: "total population" | "households";
  readonly sourceTable: "B01003" | "B01002" | "B19013";
  readonly sourceColumns: readonly string[];
  readonly estimateColumn: "B01003_E001" | "B01002_E001" | "B19013_E001";
  readonly marginOfErrorColumn: "B01003_M001" | "B01002_M001" | "B19013_M001";
  readonly marginOfErrorMethod: "ACS published 90% confidence interval";
}

const baseUrl = "https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/";

export const ACS_INDICATOR_DICTIONARY: readonly AcsIndicatorDefinition[] = Object.freeze([
  Object.freeze({ id: "acs-total-population", lockId: "acs-b01003", sourceUrl: `${baseUrl}acsdt5y2024-b01003.dat`, surveyPeriod: "2020-2024", label: "Total population", variableId: "B01003_001E", unit: "count", universe: "total population", sourceTable: "B01003", sourceColumns: Object.freeze(["B01003_E001", "B01003_M001"]), estimateColumn: "B01003_E001", marginOfErrorColumn: "B01003_M001", marginOfErrorMethod: "ACS published 90% confidence interval" }),
  Object.freeze({ id: "acs-median-age", lockId: "acs-b01002", sourceUrl: `${baseUrl}acsdt5y2024-b01002.dat`, surveyPeriod: "2020-2024", label: "Median age", variableId: "B01002_001E", unit: "years", universe: "total population", sourceTable: "B01002", sourceColumns: Object.freeze(["B01002_E001", "B01002_M001", "B01002_E002", "B01002_M002", "B01002_E003", "B01002_M003"]), estimateColumn: "B01002_E001", marginOfErrorColumn: "B01002_M001", marginOfErrorMethod: "ACS published 90% confidence interval" }),
  Object.freeze({ id: "acs-median-household-income", lockId: "acs-b19013", sourceUrl: `${baseUrl}acsdt5y2024-b19013.dat`, surveyPeriod: "2020-2024", label: "Median household income", variableId: "B19013_001E", unit: "usd", universe: "households", sourceTable: "B19013", sourceColumns: Object.freeze(["B19013_E001", "B19013_M001"]), estimateColumn: "B19013_E001", marginOfErrorColumn: "B19013_M001", marginOfErrorMethod: "ACS published 90% confidence interval" }),
]);
