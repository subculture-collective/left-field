/**
 * Helpers for `pdftotext -layout` tables whose candidates sit in columns:
 * a header row per attribute (party, given name, surname) and one or more
 * numeric rows. Cells are runs of text separated by two or more spaces; a
 * cell belongs to the column whose centre is nearest its own.
 */
export type Cell = Readonly<{ text: string; start: number; end: number; centre: number }>;

/** Splits a layout line into cells at runs of two or more spaces, keeping character positions. */
export function cells(line: string): Cell[] {
  const result: Cell[] = [];
  // The optional tail is lazy so a one-character cell ("0") ends at the first wide gap instead of reaching the next cell.
  for (const match of line.matchAll(/\S(?:.*?\S)??(?=\s{2,}|\s*$)/g)) {
    const start = match.index!, text = match[0]!, end = start + text.length;
    result.push({ text, start, end, centre: (start + end) / 2 });
  }
  return result;
}

/** Places each cell under the nearest anchor centre; several cells under one anchor are joined with a space. */
export function assign(anchors: readonly number[], row: readonly Cell[]): string[] {
  const out = anchors.map(() => [] as string[]);
  for (const cell of row) {
    let best = 0;
    for (let index = 1; index < anchors.length; index++) if (Math.abs(anchors[index]! - cell.centre) < Math.abs(anchors[best]! - cell.centre)) best = index;
    out[best]!.push(cell.text);
  }
  return out.map((parts) => parts.join(" "));
}

/**
 * Places each word of a line under the nearest anchor, for name rows where two columns' text can be printed only one
 * space apart ("ROBERTS HOUSTON-NIENABER"). Words of a multi-word name stay together when they sit nearer their own
 * column than the next.
 */
export function assignWords(anchors: readonly number[], line: string): string[] {
  const words = [...line.matchAll(/\S+/g)].map((match) => ({ text: match[0]!, start: match.index!, end: match.index! + match[0]!.length }));
  return assign(anchors, words.map((word) => ({ ...word, centre: (word.start + word.end) / 2 })));
}

/** Parses "12,345" to a number, or null when the cell is not a count. */
export const count = (text: string): number | null => /^\d{1,3}(,\d{3})*$|^\d+$/.test(text.trim()) ? Number(text.trim().replace(/,/g, "")) : null;
