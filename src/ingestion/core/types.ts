import type { PoolClient } from "pg";
import type { ReleaseId, SnapshotId, SourceId } from "@/domain/contracts";
import type { RawObjectResult } from "./raw-object-store";

export interface RawObject<T> {
  readonly value: T;
  /** Receipt produced by the adapter's configured raw-object store while extracting. */
  readonly receipt: RawObjectResult;
  readonly snapshot: {
    readonly id: SnapshotId;
    readonly sourceUrl: string;
    readonly checksumSha256: string;
    readonly upstreamRelease: string;
    readonly publishedAt: Date | null;
    readonly license: string;
    readonly usageStatus: "approved" | "restricted" | "review_required";
  };
  /** The extract phase knows this from its source manifest/header, before staging starts. */
  readonly expectedRecordCount: number;
}

export type ParseResult<T> =
  | { readonly kind: "row"; readonly row: T }
  | { readonly kind: "quarantine"; readonly sourceNaturalKey: string; readonly payloadChecksum: string; readonly errorCode: string };

export interface ValidationIssue { readonly code: string; readonly message: string; }

export interface ExtractContext {
  readonly releaseId: ReleaseId;
  readonly sourceId: SourceId;
  readonly cutoff: Date;
  readonly signal?: AbortSignal;
}

export interface SourceAdapter<TRaw, TStage> {
  readonly sourceName: string;
  readonly adapterVersion: string;
  extract(context: ExtractContext): AsyncIterable<RawObject<TRaw>>;
  parse(raw: RawObject<TRaw>): AsyncIterable<ParseResult<TStage>>;
  naturalKey(row: TStage): string;
  stage(client: PoolClient, runId: string, rows: readonly TStage[]): Promise<void>;
  validateStaged(client: PoolClient, runId: string): Promise<readonly ValidationIssue[]>;
  loadFromStage(client: PoolClient, runId: string, releaseId: ReleaseId): Promise<void>;
}
