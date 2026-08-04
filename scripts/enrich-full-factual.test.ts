import { describe, expect, it } from "vitest";

import { fecSummaryFilingId, normalizeFecDate, parseCsv, parseFullFactualArguments, parsePresidentialDistricts } from "./enrich-full-factual";

describe("accelerated full factual import", () => {
  it("parses quoted RFC 4180 fields", () => {
    expect(parseCsv('a,b\r\n"x,y","z""q"\r\n')).toEqual([["a", "b"], ["x,y", 'z"q']]);
    expect(() => parseCsv('"unterminated')).toThrow("CSV_UNTERMINATED_QUOTE");
  });

  it("requires a same-day retrieval instant and every source package", () => {
    const args = parseFullFactualArguments([
      "--release", "rel_full_20260804", "--source-release", "rel_source",
      "--cutoff", "2026-08-04", "--retrieved-at", "2026-08-04T12:00:00Z",
      "--legislators", "legislators.json", "--committees", "committees.json",
      "--assignments", "assignments.json", "--elections", "elections.csv",
      "--fec-summary", "candidate_summary_2026.csv",
      "--independent-expenditures", "independent_expenditure_2026.csv",
    ]);
    expect(args.fecSummaries).toEqual(["candidate_summary_2026.csv"]);
    expect(args.retrievedAt).toBe("2026-08-04T12:00:00.000Z");
  });

  it("rejects a partial presidential district package", () => {
    const csv = "District,Incumbent,Party,2024,,,2020,,\n,,,Harris,Trump,Total,Biden,Trump,Total\nAL-01,Member,(R),10,20,31,0,0,0\n";
    expect(() => parsePresidentialDistricts(csv)).toThrow("ELECTION_DISTRICT_CLOSURE_INVALID");
  });

  it("normalizes both FEC bulk date formats", () => {
    expect(normalizeFecDate("04/03/2024")).toBe("2024-04-03");
    expect(normalizeFecDate("20240630")).toBe("2024-06-30");
    expect(() => normalizeFecDate("06/3-0/-20")).toThrow("FEC_DATE_INVALID");
  });

  it("uses the canonical FEC filing identifier namespace", () => {
    expect(fecSummaryFilingId(2026, "H6AL01123")).toBe("fec_summary_2026_h6al01123");
  });
});
