import type { Pool } from "pg";
import { getCorrectionPool } from "@/db/client";

export type SubmitCorrectionInput = { keyHash: Buffer; subjectHash: Buffer; releaseId: string; seatCycleId?: string; fieldPath: string; explanation: string; sourceUrl?: string };
export type SubmitCorrectionResult = { outcome: "accepted" | "idempotency_conflict" | "target_unavailable" | "rate_limited" | "invalid_request"; correctionId: string | null; created: boolean; retryAfter: number | null };
export type ConsumeCorrectionAttemptResult = { allowed: boolean; retryAfter: number | null };
export type TransitionCorrectionInput = { correctionId: string; expectedSequence: number; expectedStatus: string; toStatus: string; reasonCode: string; candidateReleaseId?: string; approvedSnapshotId?: string };
export type TransitionCorrectionResult = { outcome: "transitioned" | "conflict" | "invalid_transition"; sequence: number | null };
export type CorrectionListCursor = { submittedAt: Date; id: string };
export type CorrectionListItem = { id: string; releaseId: string; seatCycleId: string | null; fieldPath: string; explanation: string; sourceUrl: string | null; submittedAt: Date; status: string; sequence: number };

function hash(value: Buffer, name: string): Buffer { if (!Buffer.isBuffer(value) || value.length !== 32) throw new Error(`${name} must be a 32-byte Buffer`); return value; }

/** Public intake API: its only implicit connection is CORRECTION_DATABASE_URL. */
export class CorrectionRepository {
  constructor(private readonly pool: Pool = getCorrectionPool()) {}
  async consumeAttempt(subjectHash: Buffer): Promise<ConsumeCorrectionAttemptResult> {
    const result = await this.pool.query<ConsumeCorrectionAttemptResult>('SELECT allowed, retry_after AS "retryAfter" FROM operations.consume_correction_attempt_v1($1)', [hash(subjectHash, "subjectHash")]);
    return result.rows[0]!;
  }
  async submit(input: SubmitCorrectionInput): Promise<SubmitCorrectionResult> {
    const result = await this.pool.query<SubmitCorrectionResult>("SELECT outcome, correction_id AS \"correctionId\", created, retry_after AS \"retryAfter\" FROM operations.submit_correction_v1($1,$2,$3,$4,$5,$6,$7)", [hash(input.keyHash, "keyHash"), hash(input.subjectHash, "subjectHash"), input.releaseId, input.seatCycleId ?? null, input.fieldPath, input.explanation, input.sourceUrl ?? null]);
    return result.rows[0]!;
  }
}

export class CorrectionReviewerRepository {
  constructor(private readonly pool: Pool) {}
  async transition(input: TransitionCorrectionInput): Promise<TransitionCorrectionResult> {
    const result = await this.pool.query<TransitionCorrectionResult>("SELECT outcome, sequence FROM operations.transition_correction_v1($1,$2,$3,$4,$5,$6,$7)", [input.correctionId, input.expectedSequence, input.expectedStatus, input.toStatus, input.reasonCode, input.candidateReleaseId ?? null, input.approvedSnapshotId ?? null]);
    return result.rows[0]!;
  }
  async list(options: { after?: CorrectionListCursor; limit?: number } = {}): Promise<CorrectionListItem[]> {
    const limit = options.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("limit must be 1..100");
    const result = await this.pool.query<CorrectionListItem>('SELECT id, release_id AS "releaseId", seat_cycle_id AS "seatCycleId", field_path AS "fieldPath", explanation, source_url AS "sourceUrl", submitted_at AS "submittedAt", status, sequence FROM operations.list_corrections_v1($1,$2,$3)', [options.after?.submittedAt ?? null, options.after?.id ?? null, limit]);
    return result.rows;
  }
}

export class CorrectionMaintenanceRepository {
  constructor(private readonly pool: Pool) {}
  async cleanup(): Promise<{ idempotencyDeleted: number; rateBucketsDeleted: number }> {
    const result = await this.pool.query<{ idempotencyDeleted: number; rateBucketsDeleted: number }>('SELECT idempotency_deleted AS "idempotencyDeleted", rate_buckets_deleted AS "rateBucketsDeleted" FROM operations.cleanup_correction_controls_v1()');
    return result.rows[0]!;
  }
}
