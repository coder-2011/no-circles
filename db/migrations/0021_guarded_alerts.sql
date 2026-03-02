ALTER TABLE "admin_alert_state" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "admin_alert_state_service_role_all" ON "admin_alert_state";
--> statement-breakpoint
CREATE POLICY "admin_alert_state_service_role_all"
ON "admin_alert_state"
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
