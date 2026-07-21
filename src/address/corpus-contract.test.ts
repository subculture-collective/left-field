import { describe, expect, it } from "vitest";
import corpusV1 from "../../data/metadata/address-resolution-corpus-v1.json";
import corpusV2 from "../../data/metadata/address-resolution-corpus-v2.json";
import contract from "../../data/metadata/census-geocoder-contract-v1.json";
import { CENSUS_BENCHMARK, CENSUS_GEOCODER_DOCUMENTATION_URL, CENSUS_GEOCODER_ENDPOINT, CENSUS_LAYERS, CENSUS_VINTAGE } from "./census-geocoder";
import type { CensusGeocodeResult, CensusGeocoder } from "./census-geocoder";
import { PostgresAddressResolver, type LocatorResult, type SeatLocator } from "./postgres-resolver";
import { addressResolutionSchema } from "@/domain/address";

type Scenario = { id: string; expectedStatus: string; errorCode?: string; senateRepresentation?: string; senateSeatCount?: number };
type Corpus = { version: number; purpose: string; scenarios: Scenario[] };

const input = { address: "Synthetic test input" };
const candidate = { longitude: -77, latitude: 39, stateGeoid: "11", congressionalDistrictGeoid: "1100" };
const coded = (candidates: CensusGeocodeResult["candidates"]): CensusGeocodeResult => ({
  benchmark: { id: "8", name: "Public_AR_ACS2025" },
  vintage: { id: "825", name: "ACS2025_ACS2025" },
  candidates,
});
const houseSeat = { officeTermId: "term_house", seatCycleId: "seat_house", geographyVersionId: "geo_house" };
const twoSenateSeats = [
  { senateClass: 1 as const, officeTermId: "term_senate_1", seatCycleId: "seat_senate_1" },
  { senateClass: 2 as const, officeTermId: "term_senate_2", seatCycleId: "seat_senate_2" },
];
const matched: LocatorResult = { kind: "matched", senateRepresentation: "two_seats", houseSeat, senateSeats: twoSenateSeats };
const noSenate: LocatorResult = { kind: "matched", senateRepresentation: "none", houseSeat, senateSeats: [] };

function resolverFor(scenario: Scenario): PostgresAddressResolver {
  const geocoder: CensusGeocoder = {
    geocode: async () => {
      if (scenario.id === "upstream-failure") throw new Error("synthetic upstream failure");
      if (scenario.id === "multiple-candidates") return coded([candidate, candidate]);
      if (scenario.id === "no-match") return coded([]);
      return coded([candidate]);
    },
  };
  const locator: SeatLocator = {
    preflight: async () => scenario.id !== "release-invariant",
    locate: async () => {
      if (scenario.id === "boundary-edge") return { kind: "geography_ambiguous" };
      if (scenario.id === "territory-outside-coverage" || scenario.id === "unsupported-district") return { kind: "unsupported" };
      if (scenario.id === "version-mismatch") return { kind: "vintage_mismatch" };
      if (scenario.id.endsWith("-no-senate")) return noSenate;
      return matched;
    },
  };
  return new PostgresAddressResolver({ releaseId: "rel_corpus", productVintage: "2025" }, geocoder, locator);
}

function expectScenarioOutput(scenario: Scenario, output: unknown): void {
  expect(addressResolutionSchema.safeParse(output).success).toBe(true);
  expect(output).toMatchObject({ status: scenario.expectedStatus, ...(scenario.errorCode ? { errorCode: scenario.errorCode } : {}) });
  if (scenario.expectedStatus === "matched") {
    expect(output).toMatchObject({ senateRepresentation: scenario.senateRepresentation ?? "two_seats" });
    expect((output as { senateSeats: unknown[] }).senateSeats).toHaveLength(scenario.senateSeatCount ?? 2);
  }
}

async function resolveScenario(scenario: Scenario): Promise<unknown> {
  if (scenario.id === "disabled" || scenario.id === "rate-limited") {
    return { releaseId: "rel_corpus", productVintage: "2025", status: scenario.expectedStatus, errorCode: scenario.errorCode };
  }
  return resolverFor(scenario).resolve(input);
}

function expectNoSensitiveFields(value: unknown): void {
  if (Array.isArray(value)) return void value.forEach(expectNoSensitiveFields);
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      expect(key).not.toMatch(/address|coordinates?|markers?/i);
      expectNoSensitiveFields(child);
    }
  }
}

function expectStrictCorpus(corpus: Corpus, version: number, count: number): void {
  expect(Object.keys(corpus).sort()).toEqual(["purpose", "scenarios", "version"]);
  expect(corpus.version).toBe(version);
  expect(corpus.purpose).toMatch(/sanitized/i);
  expect(corpus.scenarios).toHaveLength(count);
  expect(corpus.scenarios.length).toBeLessThanOrEqual(20);
  expect(new Set(corpus.scenarios.map(({ id }) => id)).size).toBe(count);
  for (const scenario of corpus.scenarios) {
    expect(Object.keys(scenario).sort()).toEqual(["errorCode", "expectedStatus", "id", "senateRepresentation", "senateSeatCount"].filter((key) => key in scenario));
    expect(scenario.id).toMatch(/^[a-z0-9-]{1,64}$/);
    expect(scenario.expectedStatus).toMatch(/^[a-z_]{1,64}$/);
    if (scenario.errorCode) expect(scenario.errorCode).toMatch(/^[A-Z_]{1,64}$/);
    if (scenario.senateRepresentation !== undefined) expect(["none", "two_seats"]).toContain(scenario.senateRepresentation);
    if (scenario.senateSeatCount !== undefined) expect([0, 2]).toContain(scenario.senateSeatCount);
    if (scenario.senateRepresentation === "none") expect(scenario.senateSeatCount).toBe(0);
    if (scenario.senateRepresentation === "two_seats") expect(scenario.senateSeatCount).toBe(2);
  }
  expectNoSensitiveFields(corpus);
}

describe("address-resolution corpus and Census contract", () => {
  it("loads both corpus versions with strict, bounded, sanitized shapes", () => {
    expectStrictCorpus(corpusV1, 1, 11);
    expectStrictCorpus(corpusV2, 2, 17);
  });

  it("preserves v1 scenarios and adds exactly the six matched no-Senate cases", () => {
    const v1Scenarios = corpusV1.scenarios.map(({ id, expectedStatus, errorCode }) => ({ id, expectedStatus, ...(errorCode ? { errorCode } : {}) }));
    const preservedV2Scenarios = corpusV2.scenarios.slice(0, corpusV1.scenarios.length).map(({ id, expectedStatus, errorCode }) => ({ id, expectedStatus, ...(errorCode ? { errorCode } : {}) }));
    expect(preservedV2Scenarios).toEqual(v1Scenarios);
    expect(corpusV2.scenarios.slice(corpusV1.scenarios.length)).toEqual([
      { id: "dc-no-senate", expectedStatus: "matched", senateRepresentation: "none", senateSeatCount: 0 },
      { id: "pr-no-senate", expectedStatus: "matched", senateRepresentation: "none", senateSeatCount: 0 },
      { id: "gu-no-senate", expectedStatus: "matched", senateRepresentation: "none", senateSeatCount: 0 },
      { id: "vi-no-senate", expectedStatus: "matched", senateRepresentation: "none", senateSeatCount: 0 },
      { id: "as-no-senate", expectedStatus: "matched", senateRepresentation: "none", senateSeatCount: 0 },
      { id: "mp-no-senate", expectedStatus: "matched", senateRepresentation: "none", senateSeatCount: 0 },
    ]);
  });

  it("drives retained v1 and v2 scenarios through the shared decision contract", async () => {
    const v1Outputs = await Promise.all(corpusV1.scenarios.map(resolveScenario));
    const v2Outputs = await Promise.all(corpusV2.scenarios.map(resolveScenario));

    for (const [index, scenario] of corpusV1.scenarios.entries()) {
      expectScenarioOutput(scenario, v1Outputs[index]);
      expectScenarioOutput(corpusV2.scenarios[index]!, v2Outputs[index]);
      expect(v2Outputs[index]).toMatchObject({
        status: (v1Outputs[index] as { status: string }).status,
        ...((v1Outputs[index] as { errorCode?: string }).errorCode ? { errorCode: (v1Outputs[index] as { errorCode: string }).errorCode } : {}),
      });
    }

    for (const [index, scenario] of corpusV2.scenarios.slice(corpusV1.scenarios.length).entries()) {
      const output = v2Outputs[index + corpusV1.scenarios.length];
      expectScenarioOutput(scenario, output);
      expect(output).toMatchObject({ status: "matched", senateRepresentation: "none", senateSeats: [] });
    }
  });

  it("locks the strict Census request contract to exported adapter constants", () => {
    expect(Object.keys(contract).sort()).toEqual(["documentationUrls", "purpose", "request", "sourceUrls", "version"]);
    expect(Object.keys(contract.request).sort()).toEqual(["benchmark", "format", "layers", "origin", "path", "vintage"]);
    expect(Object.keys(contract.request.benchmark).sort()).toEqual(["id", "name"]);
    expect(Object.keys(contract.request.vintage).sort()).toEqual(["id", "name"]);
    expect(contract.version).toBe(1);
    const endpoint = new URL(CENSUS_GEOCODER_ENDPOINT);
    expect(contract.request).toEqual({ origin: endpoint.origin, path: endpoint.pathname, benchmark: CENSUS_BENCHMARK, vintage: CENSUS_VINTAGE, layers: CENSUS_LAYERS, format: "json" });
    expect(contract.documentationUrls).toEqual([CENSUS_GEOCODER_DOCUMENTATION_URL]);
    expect(contract.sourceUrls).toEqual([CENSUS_GEOCODER_ENDPOINT]);
    expect(contract.documentationUrls.length + contract.sourceUrls.length).toBeLessThanOrEqual(4);
    expect(contract.request.layers).toHaveLength(2);
    expect(contract.purpose.length).toBeLessThanOrEqual(160);
    expectNoSensitiveFields(contract);
  });
});
