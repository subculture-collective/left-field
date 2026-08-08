import { describe, expect, it } from "vitest";

import { buildAtLargeCd119CountyUniverse, validateAtLargeCd119CountyUniverse } from "./at-large-cd119-county-universe";

describe("CD119 at-large county universes", () => {
  it("binds all six states to exact official block and Gazetteer county sets", () => {
    const value = buildAtLargeCd119CountyUniverse();
    expect(value.summary).toEqual({ atLargeStates: 6, exactCountyUniverses: 6, counties: 189, incompatibleRows: 0 });
    expect(value.rows.map((row) => [row.stateCode, row.countyCount])).toEqual([["AK", 30], ["DE", 3], ["ND", 53], ["SD", 66], ["VT", 14], ["WY", 23]]);
    expect(value.rows.every((row) => row.exactCountyUniverseMatch && row.censusBlockCount > 0)).toBe(true);
    expect(validateAtLargeCd119CountyUniverse(value)).toEqual(value);
  });
});
