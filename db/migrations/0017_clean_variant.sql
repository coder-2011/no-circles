ALTER TABLE "outbound_send_idempotency"
ADD COLUMN "issue_variant" text;
--> statement-breakpoint
UPDATE "outbound_send_idempotency"
SET "issue_variant" = 'daily'
WHERE "issue_variant" IS NULL;
--> statement-breakpoint
ALTER TABLE "outbound_send_idempotency"
ALTER COLUMN "issue_variant" SET DEFAULT 'daily';
--> statement-breakpoint
ALTER TABLE "outbound_send_idempotency"
ALTER COLUMN "issue_variant" SET NOT NULL;
