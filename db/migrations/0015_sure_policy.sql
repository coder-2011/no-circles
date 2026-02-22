ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "processed_webhooks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "cron_selection_leases" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "outbound_send_idempotency" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "users_service_role_all" ON "users";
--> statement-breakpoint
CREATE POLICY "users_service_role_all"
ON "users"
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS "users_authenticated_select_self_by_email" ON "users";
--> statement-breakpoint
CREATE POLICY "users_authenticated_select_self_by_email"
ON "users"
FOR SELECT
TO authenticated
USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
--> statement-breakpoint
DROP POLICY IF EXISTS "users_authenticated_update_self_by_email" ON "users";
--> statement-breakpoint
CREATE POLICY "users_authenticated_update_self_by_email"
ON "users"
FOR UPDATE
TO authenticated
USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
WITH CHECK (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
--> statement-breakpoint
DROP POLICY IF EXISTS "processed_webhooks_service_role_all" ON "processed_webhooks";
--> statement-breakpoint
CREATE POLICY "processed_webhooks_service_role_all"
ON "processed_webhooks"
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS "cron_selection_leases_service_role_all" ON "cron_selection_leases";
--> statement-breakpoint
CREATE POLICY "cron_selection_leases_service_role_all"
ON "cron_selection_leases"
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS "outbound_send_idempotency_service_role_all" ON "outbound_send_idempotency";
--> statement-breakpoint
CREATE POLICY "outbound_send_idempotency_service_role_all"
ON "outbound_send_idempotency"
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
