CREATE TABLE "processed_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"webhook_id" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "processed_webhooks_provider_webhook_id_unique" ON "processed_webhooks" USING btree ("provider","webhook_id");--> statement-breakpoint
CREATE INDEX "processed_webhooks_processed_at_idx" ON "processed_webhooks" USING btree ("processed_at");
