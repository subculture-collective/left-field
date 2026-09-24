/**
 * Delimited-text reader shared by intake specs (CSV, TSV, pipe files).
 *
 * Handles RFC 4180 quoting, doubled quotes, CRLF, and a UTF-8 byte-order mark.
 * Ragged rows are rejected because every retained results export so far is
 * rectangular; a state that ships ragged rows should pre-normalise in its spec.
 */
export interface DelimitedTable {
  readonly header: readonly string[];
  readonly rows: readonly (readonly string[])[];
  /** Rows as objects keyed by trimmed header text. */
  records(): Record<string, string>[];
  /** Index of a header, failing loudly when the column is absent. */
  column(name: string): number;
}

const fail = (code: string): never => {
  throw new Error(`TABLE_${code}`);
};

export function parseDelimited(
  text: string,
  delimiter: "," | "\t" | "|" | ";" = ",",
): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index++) {
    const char = input[index]!;
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index++;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') {
      if (field.length) fail("QUOTE_INSIDE_FIELD");
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (quoted) fail("UNTERMINATED_QUOTE");
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((line) => line.length > 1 || line[0] !== "");
}

export function readDelimitedTable(
  text: string,
  delimiter: "," | "\t" | "|" | ";" = ",",
): DelimitedTable {
  const lines = parseDelimited(text, delimiter);
  const header = (lines[0] ?? fail("HEADER_MISSING")).map((cell) =>
    cell.trim(),
  );
  const rows = lines.slice(1);
  for (const line of rows)
    if (line.length !== header.length) fail("ROW_WIDTH_INVALID");
  const index = new Map(header.map((name, position) => [name, position]));
  return {
    header,
    rows,
    records: () =>
      rows.map((line) =>
        Object.fromEntries(header.map((name, position) => [name, line[position]!])),
      ),
    column: (name) => index.get(name) ?? fail(`COLUMN_MISSING:${name}`),
  };
}

/** Parses a source vote count such as "1,234" or "0"; blank is rejected. */
export const tableInteger = (value: string | undefined): number => {
  const cleaned = (value ?? "").trim().replace(/,/g, "");
  if (!/^(?:0|[1-9]\d*)$/.test(cleaned)) return fail("INTEGER_INVALID");
  const parsed = Number(cleaned);
  return Number.isSafeInteger(parsed) ? parsed : fail("INTEGER_INVALID");
};
