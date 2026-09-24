import { describe, expect, it } from "vitest";

import { parseDelimited, readDelimitedTable, tableInteger } from "./table";

describe("delimited table reader", () => {
  it("handles quotes, doubled quotes, CRLF, and a byte-order mark", () => {
    const text = '﻿a,b\r\n"x, y","say ""hi"""\r\n1,2\n';
    expect(parseDelimited(text)).toEqual([["a", "b"], ["x, y", 'say "hi"'], ["1", "2"]]);
  });

  it("exposes records and column lookup", () => {
    const table = readDelimitedTable("office\tvotes\nSenate\t1,234\n", "\t");
    expect(table.records()).toEqual([{ office: "Senate", votes: "1,234" }]);
    expect(table.column("votes")).toBe(1);
    expect(() => table.column("missing")).toThrow("TABLE_COLUMN_MISSING:missing");
    expect(tableInteger(table.rows[0]![1])).toBe(1234);
  });

  it("rejects ragged rows, unterminated quotes, and non-integers", () => {
    expect(() => readDelimitedTable("a,b\n1\n")).toThrow("TABLE_ROW_WIDTH_INVALID");
    expect(() => parseDelimited('a,"b\n')).toThrow("TABLE_UNTERMINATED_QUOTE");
    expect(() => tableInteger("12.5")).toThrow("TABLE_INTEGER_INVALID");
    expect(() => tableInteger("")).toThrow("TABLE_INTEGER_INVALID");
  });
});
