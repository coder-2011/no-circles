ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "processed_webhooks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "cron_selection_leases" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "outbound_send_idempotency" ENABLE ROW LEVEL SECURITY;
