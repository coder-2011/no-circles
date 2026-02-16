ALTER TABLE "users" ADD COLUMN "sent_url_bloom_bits" text;

CREATE TABLE "outbound_send_idempotency" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "idempotency_key" text NOT NULL,
  "user_id" uuid NOT NULL,
  "local_issue_date" date NOT NULL,
  "status" text DEFAULT 'processing' NOT NULL,
  "provider_message_id" text,
  "failure_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outbound_send_idempotency" ADD CONSTRAINT "outbound_send_idempotency_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "outbound_send_idempotency_key_unique" ON "outbound_send_idempotency" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE INDEX "outbound_send_idempotency_user_local_date_idx" ON "outbound_send_idempotency" USING btree ("user_id", "local_issue_date");
--> statement-breakpoint
CREATE INDEX "outbound_send_idempotency_status_idx" ON "outbound_send_idempotency" USING btree ("status");
