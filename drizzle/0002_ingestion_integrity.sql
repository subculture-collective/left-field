DO $$ BEGIN IF EXISTS (SELECT 1 FROM ingest_runs) THEN RAISE EXCEPTION 'Cannot install ingestion integrity: ingest_runs contains existing rows; archive or remove them before migrating (no backfill is performed).'; END IF; END $$;--> statement-breakpoint
CREATE TYPE "public"."ingest_failure_code" AS ENUM('ingest_error', 'lease_expired');--> statement-breakpoint
CREATE TYPE "public"."raw_store_kind" AS ENUM('local', 's3');--> statement-breakpoint
ALTER TABLE "ingest_runs" ADD COLUMN "snapshot_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "ingest_runs" ADD COLUMN "upstream_release" text NOT NULL;--> statement-breakpoint
ALTER TABLE "ingest_runs" ADD COLUMN "raw_store_kind" "raw_store_kind" NOT NULL;--> statement-breakpoint
ALTER TABLE "ingest_runs" ADD COLUMN "raw_store_locator" text NOT NULL;--> statement-breakpoint
ALTER TABLE "ingest_runs" ADD COLUMN "raw_object_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "ingest_runs" ADD COLUMN "raw_object_sha256" text NOT NULL;--> statement-breakpoint
ALTER TABLE "ingest_runs" ADD COLUMN "raw_object_byte_size" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "ingest_runs" ADD COLUMN "raw_object_version_id" text;--> statement-breakpoint
ALTER TABLE "ingest_runs" ADD COLUMN "raw_object_etag" text;--> statement-breakpoint
ALTER TABLE "ingest_runs" ADD COLUMN "lease_token" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "ingest_runs" ADD COLUMN "heartbeat_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "ingest_runs" ADD COLUMN "lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ingest_runs" ADD COLUMN "failure_code" "ingest_failure_code";--> statement-breakpoint
ALTER TABLE "ingest_runs" ADD CONSTRAINT "ingest_runs_release_id_snapshot_id_source_snapshots_release_id_id_fk" FOREIGN KEY ("release_id","snapshot_id") REFERENCES "public"."source_snapshots"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingest_runs_snapshot_fk_idx" ON "ingest_runs" USING btree ("release_id","snapshot_id");--> statement-breakpoint
CREATE INDEX "ingest_runs_identity_attempt_idx" ON "ingest_runs" USING btree ("release_id","source_id","adapter_version","upstream_release","raw_object_sha256","status","started_at" DESC);--> statement-breakpoint
CREATE UNIQUE INDEX "ingest_runs_one_live_identity_uq" ON "ingest_runs" USING btree ("release_id","source_id","adapter_version","upstream_release","raw_object_sha256") WHERE "ingest_runs"."status" IN ('running','validated','loaded');--> statement-breakpoint
CREATE INDEX "ingest_runs_expired_running_lease_idx" ON "ingest_runs" USING btree ("lease_expires_at") WHERE "ingest_runs"."status"='running';--> statement-breakpoint
ALTER TABLE "ingest_runs" ADD CONSTRAINT "ingest_runs_receipt_ck" CHECK (length("ingest_runs"."upstream_release")>0 AND length("ingest_runs"."raw_store_locator")>0 AND length("ingest_runs"."raw_object_key")>0 AND "ingest_runs"."raw_object_key" !~ '(^/|\\|(^|/)\.\.(/|$))' AND "ingest_runs"."raw_object_sha256" ~ '^[a-f0-9]{64}$' AND "ingest_runs"."raw_object_byte_size">=0 AND (("ingest_runs"."raw_store_kind"='s3' AND "ingest_runs"."raw_object_version_id" IS NOT NULL) OR ("ingest_runs"."raw_store_kind"='local' AND "ingest_runs"."raw_object_version_id" IS NULL)));--> statement-breakpoint
ALTER TABLE "ingest_runs" ADD CONSTRAINT "ingest_runs_lifecycle_ck" CHECK (("ingest_runs"."status"='running' AND "ingest_runs"."completed_at" IS NULL AND "ingest_runs"."failure_code" IS NULL AND "ingest_runs"."lease_expires_at">"ingest_runs"."heartbeat_at") OR ("ingest_runs"."status" IN ('validated','loaded') AND "ingest_runs"."completed_at" IS NOT NULL AND "ingest_runs"."failure_code" IS NULL AND "ingest_runs"."lease_expires_at" IS NULL) OR ("ingest_runs"."status"='failed' AND "ingest_runs"."completed_at" IS NOT NULL AND "ingest_runs"."failure_code" IS NOT NULL AND "ingest_runs"."lease_expires_at" IS NULL));--> statement-breakpoint
--> statement-breakpoint
-- Hand-owned lifecycle defense. Keep operational rows outside release digests.
CREATE OR REPLACE FUNCTION guard_ingest_run() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'running' OR NEW.completed_at IS NOT NULL OR NEW.failure_code IS NOT NULL OR NEW.staged_count<>0 OR NEW.quarantined_count<>0 OR NEW.lease_expires_at<=NEW.heartbeat_at THEN RAISE EXCEPTION 'new ingest run must start running with zero counts and a valid lease' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM source_snapshots s WHERE s.release_id=NEW.release_id AND s.id=NEW.snapshot_id AND s.checksum_sha256=NEW.raw_object_sha256) THEN RAISE EXCEPTION 'ingest receipt checksum must equal snapshot checksum' USING ERRCODE='23514'; END IF; RETURN NEW;
 END IF;
 IF (NEW.id,NEW.release_id,NEW.source_id,NEW.snapshot_id,NEW.adapter_version,NEW.upstream_release,NEW.raw_store_kind,NEW.raw_store_locator,NEW.raw_object_key,NEW.raw_object_sha256,NEW.raw_object_byte_size,NEW.raw_object_version_id,NEW.raw_object_etag,NEW.lease_token,NEW.started_at,NEW.extracted_count) IS DISTINCT FROM (OLD.id,OLD.release_id,OLD.source_id,OLD.snapshot_id,OLD.adapter_version,OLD.upstream_release,OLD.raw_store_kind,OLD.raw_store_locator,OLD.raw_object_key,OLD.raw_object_sha256,OLD.raw_object_byte_size,OLD.raw_object_version_id,OLD.raw_object_etag,OLD.lease_token,OLD.started_at,OLD.extracted_count) THEN RAISE EXCEPTION 'ingest receipt, identity, and lease token are immutable' USING ERRCODE='23514'; END IF;
 IF OLD.status='running' AND OLD.lease_expires_at<=clock_timestamp() THEN
  IF NEW.status<>'failed' OR NEW.failure_code<>'lease_expired' OR NEW.completed_at IS NULL OR NEW.lease_expires_at IS NOT NULL OR NEW.heartbeat_at IS DISTINCT FROM OLD.heartbeat_at OR NEW.staged_count IS DISTINCT FROM OLD.staged_count OR NEW.quarantined_count IS DISTINCT FROM OLD.quarantined_count THEN RAISE EXCEPTION 'expired ingest lease may only transition to lease_expired failure' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 ELSIF OLD.status='running' THEN
  IF NEW.status='running' THEN IF NEW.completed_at IS NOT NULL OR NEW.failure_code IS NOT NULL OR NEW.heartbeat_at<OLD.heartbeat_at OR NEW.lease_expires_at<=NEW.heartbeat_at OR NEW.staged_count<OLD.staged_count OR NEW.quarantined_count<OLD.quarantined_count THEN RAISE EXCEPTION 'running updates require lease-owner heartbeat and monotonic counts' USING ERRCODE='23514'; END IF;
  ELSIF NEW.status='validated' THEN IF NEW.completed_at IS NULL OR NEW.failure_code IS NOT NULL OR NEW.lease_expires_at IS NOT NULL OR NEW.staged_count+NEW.quarantined_count<>NEW.extracted_count THEN RAISE EXCEPTION 'validated run requires reconciliation and cleared lease' USING ERRCODE='23514'; END IF;
  ELSIF NEW.status='failed' THEN IF NEW.completed_at IS NULL OR NEW.failure_code IS NULL OR NEW.lease_expires_at IS NOT NULL THEN RAISE EXCEPTION 'failed run requires failure code and cleared lease' USING ERRCODE='23514'; END IF;
  ELSE RAISE EXCEPTION 'illegal ingest transition' USING ERRCODE='23514'; END IF;
 ELSIF OLD.status='validated' THEN IF NEW.status<>'loaded' OR NEW.completed_at IS NULL OR NEW.failure_code IS NOT NULL OR NEW.lease_expires_at IS NOT NULL OR NEW.heartbeat_at IS DISTINCT FROM OLD.heartbeat_at OR NEW.staged_count IS DISTINCT FROM OLD.staged_count OR NEW.quarantined_count IS DISTINCT FROM OLD.quarantined_count THEN RAISE EXCEPTION 'validated run may only load with cleared lease and unchanged counts' USING ERRCODE='23514'; END IF;
 ELSE RAISE EXCEPTION 'terminal ingest run is immutable' USING ERRCODE='23514'; END IF; RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_ingest_publication() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.status='candidate' AND NEW.status='published' AND EXISTS(SELECT 1 FROM ingest_runs WHERE release_id=NEW.id AND status='running') THEN RAISE EXCEPTION 'cannot publish a release with running ingestion' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;--> statement-breakpoint
CREATE TRIGGER data_releases_ingest_publication_guard BEFORE UPDATE ON data_releases FOR EACH ROW EXECUTE FUNCTION guard_ingest_publication();
