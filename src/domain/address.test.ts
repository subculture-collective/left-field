import { describe, expect, it } from "vitest";

import { ADDRESS_RESOLUTION_MAX_SERIALIZED_BYTES, addressResolutionSchema, assertBoundedAddressResolution } from "./address";

describe("address resolution output bounds", () => {
  const matched = {
    releaseId: "rel_1", productVintage: "2024",
    geocoderBenchmark: { id: "benchmark", name: "Benchmark" },
    geocoderVintage: { id: "vintage", name: "Vintage" },
    matchQuality: "single_candidate" as const, status: "matched" as const,
    senateRepresentation: "two_seats" as const,
    houseSeat: { officeTermId: "term_house", seatCycleId: "seat_house", geographyVersionId: "geo_house" },
    senateSeats: [
      { senateClass: 1 as const, officeTermId: "term_senate_1", seatCycleId: "seat_senate_1" },
      { senateClass: 2 as const, officeTermId: "term_senate_2", seatCycleId: "seat_senate_2" },
    ],
  };

  it("bounds every variable output identifier and metadata string", () => {
    expect(addressResolutionSchema.safeParse({ ...matched, releaseId: `rel_${"x".repeat(124)}` }).success).toBe(true);
    expect(addressResolutionSchema.safeParse({ ...matched, releaseId: `rel_${"x".repeat(125)}` }).success).toBe(false);
    expect(addressResolutionSchema.safeParse({ ...matched, productVintage: "x".repeat(65) }).success).toBe(false);
    expect(addressResolutionSchema.safeParse({ ...matched, geocoderBenchmark: { id: "x".repeat(129), name: "Benchmark" } }).success).toBe(false);
    expect(addressResolutionSchema.safeParse({ ...matched, houseSeat: { ...matched.houseSeat, officeTermId: `term_${"x".repeat(124)}` } }).success).toBe(false);
  });

  it("enforces a finite serialized response size independently of routes", () => {
    const resolution = assertBoundedAddressResolution(matched);
    expect(new TextEncoder().encode(JSON.stringify(resolution)).byteLength).toBeLessThanOrEqual(ADDRESS_RESOLUTION_MAX_SERIALIZED_BYTES);
  });
});
