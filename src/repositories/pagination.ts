import { z } from "zod";

import { releaseIdSchema } from "@/domain/contracts";
import { seatPageRequestSchema, seatQuerySchema } from "@/domain/repository";
import type { ReleaseId } from "@/domain/contracts";
import type { SeatListItem, SeatPageRequest, SeatQuery } from "@/domain/repository";

const byteCompare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
type TextSeatSort = "state" | "district" | "incumbent_name";
type NumericSeatSort = "election_year" | "cash_on_hand" | "presidential_margin_2024";
type CursorQuery<T extends TextSeatSort | NumericSeatSort> = SeatQuery & { sort: T };
export type SeatCursor =
  | { v: 1; releaseId: ReleaseId; query: CursorQuery<TextSeatSort>; missing: true; sortValue: null; id: string }
  | { v: 1; releaseId: ReleaseId; query: CursorQuery<TextSeatSort>; missing: false; sortValue: string; id: string }
  | { v: 1; releaseId: ReleaseId; query: CursorQuery<NumericSeatSort>; missing: true; sortValue: null; id: string }
  | { v: 1; releaseId: ReleaseId; query: CursorQuery<NumericSeatSort>; missing: false; sortValue: number; id: string };
type SeatCursorInput = { v: 1; releaseId: ReleaseId; query: SeatQuery; missing: boolean; sortValue: string | number | null; id: string };
const cursorSchema = z.object({
  v: z.literal(1), releaseId: releaseIdSchema, query: seatQuerySchema,
  missing: z.boolean(), sortValue: z.union([z.string(), z.number(), z.null()]), id: z.string().min(1),
}).strict().superRefine((cursor, context) => {
  const valueIsNull = cursor.sortValue === null;
  if (cursor.missing !== valueIsNull) context.addIssue({ code: "custom", message: "Cursor missing must match a null sort value", path: ["missing"] });
  if (valueIsNull) return;
  const expectsString = cursor.query.sort === "state" || cursor.query.sort === "district" || cursor.query.sort === "incumbent_name";
  if (expectsString ? typeof cursor.sortValue !== "string" : typeof cursor.sortValue !== "number") context.addIssue({ code: "custom", message: "Cursor sort value has the wrong type", path: ["sortValue"] });
});

export function normalizedSeatQuery(request: SeatPageRequest): SeatQuery {
  const parsed = seatPageRequestSchema.parse(request);
  return seatQuerySchema.parse({ identitySearch: parsed.identitySearch, chamber: parsed.chamber, stateCode: parsed.stateCode, party: parsed.party, incumbencyStatus: parsed.incumbencyStatus, electionYear: parsed.electionYear, sort: parsed.sort, direction: parsed.direction });
}

export function encodeSeatCursor(cursor: SeatCursorInput): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeSeatCursor(encoded: string, releaseId: ReleaseId, query: SeatQuery): SeatCursor {
  if (encoded.length > 500) throw new Error("Invalid seat page cursor");
  let raw: unknown;
  try { raw = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); } catch { throw new Error("Invalid seat page cursor"); }
  const cursor = cursorSchema.safeParse(raw);
  if (!cursor.success || cursor.data.releaseId !== releaseId || JSON.stringify(cursor.data.query) !== JSON.stringify(query)) throw new Error("Seat page cursor does not match this request");
  return cursor.data as SeatCursor;
}

export function seatSortValue(item: SeatListItem, query: SeatQuery): string | number | null {
  return ({ state: item.stateCode, district: item.districtCode === "AL" ? "00" : item.districtCode, incumbent_name: item.incumbentName, election_year: item.electionYear, cash_on_hand: item.cashOnHand.kind === "value" || item.cashOnHand.kind === "aggregate" ? item.cashOnHand.value : null, presidential_margin_2024: item.presidentialMargin2024.value.kind === "value" ? item.presidentialMargin2024.value.value : null })[query.sort];
}

/** Pages an already sorted projection, retaining keyset information for a future SQL adapter. */
export function pageSortedSeatItems(items: readonly SeatListItem[], releaseId: ReleaseId, request: SeatPageRequest) {
  const parsed = seatPageRequestSchema.parse(request); const query = normalizedSeatQuery(parsed);
  let start = 0;
  if (parsed.cursor) {
    const cursor = decodeSeatCursor(parsed.cursor, releaseId, query);
    const index = items.findIndex((item) => String(item.id) === cursor.id && (seatSortValue(item, query) === null) === cursor.missing && seatSortValue(item, query) === cursor.sortValue);
    if (index < 0) throw new Error("Seat page cursor is no longer valid");
    start = index + 1;
  }
  const page = items.slice(start, start + parsed.limit);
  const last = page.at(-1);
  const nextCursor = last && start + page.length < items.length ? encodeSeatCursor({ v: 1, releaseId, query, missing: seatSortValue(last, query) === null, sortValue: seatSortValue(last, query), id: String(last.id) } as SeatCursor) : null;
  return { items: page, nextCursor, total: items.length };
}

export { byteCompare };
