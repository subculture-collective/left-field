ALTER TABLE "fec_v2_sanitized_filings" ADD COLUMN "ledger_identity_sha256" text;
--> statement-breakpoint
UPDATE "fec_v2_sanitized_filings" AS filing SET "ledger_identity_sha256" = entry."entry_identity_sha256" FROM "fec_v2_filing_ledger_entries" AS entry WHERE (entry."release_id",entry."plan_sha256",entry."ledger_sha256",entry."file_number")=(filing."release_id",filing."plan_sha256",filing."ledger_sha256",filing."file_number");
--> statement-breakpoint
ALTER TABLE "fec_v2_sanitized_filings" ALTER COLUMN "ledger_identity_sha256" SET NOT NULL;
