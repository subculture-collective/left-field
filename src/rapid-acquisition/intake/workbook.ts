import { unzipSync } from "fflate";

/**
 * Minimal OOXML (.xlsx) sheet reader shared by intake specs.
 *
 * Extracted from the per-state parsers so a new state workbook needs only the
 * column/row interpretation, not another copy of the zip and XML handling.
 * Merged ranges are expanded so every covered cell carries the anchor value.
 */
export interface WorkbookSheet {
  readonly cells: ReadonlyMap<string, string>;
  readonly maxColumn: number;
  readonly maxRow: number;
  /** Trimmed cell text, or "" when the cell is absent. */
  at(column: number, row: number): string;
  /** 1-based row numbers whose column-A text equals `text` after trimming. */
  rowsWhereColumnEquals(column: number, text: string): number[];
}

const fail = (code: string): never => {
  throw new Error(`WORKBOOK_${code}`);
};

const decode = (value: string): string =>
  value
    .split("&lt;")
    .join("<")
    .split("&gt;")
    .join(">")
    .split("&quot;")
    .join('"')
    .split("&apos;")
    .join("'")
    .split("&amp;")
    .join("&")
    .replace(/&#(\d+);/g, (_match: string, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_match: string, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );

const textNodes = (xml: string): string =>
  [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map((match) => decode(match[1]!))
    .join("");

export const columnNumber = (reference: string): number => {
  const letters = reference.match(/^[A-Z]+/)?.[0];
  if (!letters) return fail("CELL_REFERENCE_INVALID");
  return [...letters].reduce(
    (value, letter) => value * 26 + letter.charCodeAt(0) - 64,
    0,
  );
};

export const cellReference = (column: number, row: number): string => {
  let name = "";
  let current = column;
  while (current > 0) {
    current--;
    name = String.fromCharCode(65 + (current % 26)) + name;
    current = Math.floor(current / 26);
  }
  return `${name}${row}`;
};

/** Parses a non-negative integer cell; blank cells are rejected by default. */
export const workbookInteger = (
  value: string | undefined,
  options: { blankAsZero?: boolean } = {},
): number => {
  if ((value === undefined || value === "") && options.blankAsZero) return 0;
  if (value === undefined || !/^(?:0|[1-9]\d*)$/.test(value))
    return fail("INTEGER_INVALID");
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fail("INTEGER_INVALID");
};

const part = (files: Record<string, Uint8Array>, name: string): string => {
  const value = files[name] ?? files[`/${name}`];
  return value
    ? Buffer.from(value).toString("utf8")
    : fail(`PART_MISSING:${name}`);
};

export function readWorkbookSheet(
  bytes: Buffer,
  sheetName: string,
): WorkbookSheet {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(bytes));
  } catch {
    return fail("XLSX_INVALID");
  }
  const workbook = part(files, "xl/workbook.xml");
  const relationships = part(files, "xl/_rels/workbook.xml.rels");
  const sheetAttributes = [...workbook.matchAll(/<sheet\b([^>]*)\/?\s*>/g)]
    .map((match) => match[1]!)
    .find((attributes) => attributes.includes(`name="${sheetName}"`));
  const relationshipId = sheetAttributes?.match(/(?:\br:id|\bid)="([^"]+)"/)?.[1];
  const relationship = relationshipId
    ? [...relationships.matchAll(/<Relationship\b([^>]*)\/?\s*>/g)]
        .map((match) => match[1]!)
        .find((attributes) => attributes.includes(`Id="${relationshipId}"`))
    : undefined;
  const target = relationship?.match(/\bTarget="([^"]+)"/)?.[1];
  if (!target) return fail(`SHEET_MISSING:${sheetName}`);
  const sharedXml = files["xl/sharedStrings.xml"]
    ? part(files, "xl/sharedStrings.xml")
    : "";
  const shared = [
    ...sharedXml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g),
  ].map((match) => textNodes(match[1]!));
  const sheetPath = target.startsWith("/")
    ? target.slice(1)
    : `xl/${target.replace(/^\.\//, "")}`;
  const sheet = part(files, sheetPath);
  const cells = new Map<string, string>();
  for (const match of sheet.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attributes = match[1]!;
    const body = match[2] ?? "";
    const reference = attributes.match(/\br="([A-Z]+\d+)"/)?.[1];
    if (!reference) return fail("CELL_REFERENCE_INVALID");
    const type = attributes.match(/\bt="([^"]+)"/)?.[1];
    const raw = body.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1];
    cells.set(
      reference,
      type === "s"
        ? (shared[workbookInteger(raw)] ?? fail("SHARED_STRING_INVALID"))
        : type === "inlineStr"
          ? textNodes(body)
          : raw === undefined
            ? ""
            : decode(raw),
    );
  }
  for (const merge of sheet.matchAll(
    /<mergeCell\b[^>]*\bref="([A-Z]+)(\d+):([A-Z]+)(\d+)"[^>]*\/?\s*>/g,
  )) {
    const value = cells.get(`${merge[1]}${merge[2]}`) ?? "";
    for (let row = Number(merge[2]); row <= Number(merge[4]); row++)
      for (
        let column = columnNumber(merge[1]!);
        column <= columnNumber(merge[3]!);
        column++
      )
        cells.set(cellReference(column, row), value);
  }
  let maxColumn = 0;
  let maxRow = 0;
  for (const reference of cells.keys()) {
    maxColumn = Math.max(maxColumn, columnNumber(reference));
    maxRow = Math.max(maxRow, Number(reference.match(/\d+$/)?.[0] ?? 0));
  }
  return {
    cells,
    maxColumn,
    maxRow,
    at: (column, row) => (cells.get(cellReference(column, row)) ?? "").trim(),
    rowsWhereColumnEquals(column, text) {
      const rows: number[] = [];
      for (let row = 1; row <= maxRow; row++)
        if (this.at(column, row) === text) rows.push(row);
      return rows;
    },
  };
}
