ALTER TABLE "users"
ADD COLUMN "last_reflection_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE "user_email_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "subject" text,
  "body_text" text NOT NULL,
  "provider_message_id" text,
  "issue_variant" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_email_history_kind_check" CHECK ("kind" in ('sent', 'reply')),
  CONSTRAINT "user_email_history_issue_variant_check" CHECK ("issue_variant" is null or "issue_variant" in ('daily', 'welcome'))
);
--> statement-breakpoint
ALTER TABLE "user_email_history"
ADD CONSTRAINT "user_email_history_user_id_users_id_fk"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "user_email_history_user_kind_created_at_idx"
ON "user_email_history" USING btree ("user_id", "kind", "created_at");
--> statement-breakpoint
ALTER TABLE "user_email_history" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "user_email_history_service_role_all" ON "user_email_history";
--> statement-breakpoint
CREATE POLICY "user_email_history_service_role_all"
ON "user_email_history"
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS "user_email_history_authenticated_select_self" ON "user_email_history";
--> statement-breakpoint
CREATE POLICY "user_email_history_authenticated_select_self"
ON "user_email_history"
FOR SELECT
TO authenticated
USING (
  exists (
    select 1
    from "users"
    where "users"."id" = "user_email_history"."user_id"
      and lower("users"."email") = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);
