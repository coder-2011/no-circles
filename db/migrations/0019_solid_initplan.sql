CREATE OR REPLACE FUNCTION public.current_auth_email()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT lower(coalesce((select auth.jwt() ->> 'email'), ''));
$$;
--> statement-breakpoint
DROP POLICY IF EXISTS "users_authenticated_select_self_by_email" ON "users";
--> statement-breakpoint
CREATE POLICY "users_authenticated_select_self_by_email"
ON "users"
FOR SELECT
TO authenticated
USING (lower(email) = (select public.current_auth_email()));
--> statement-breakpoint
DROP POLICY IF EXISTS "users_authenticated_update_self_by_email" ON "users";
--> statement-breakpoint
CREATE POLICY "users_authenticated_update_self_by_email"
ON "users"
FOR UPDATE
TO authenticated
USING (lower(email) = (select public.current_auth_email()))
WITH CHECK (lower(email) = (select public.current_auth_email()));
--> statement-breakpoint
DROP POLICY IF EXISTS "user_email_history_authenticated_select_self" ON "user_email_history";
--> statement-breakpoint
CREATE POLICY "user_email_history_authenticated_select_self"
ON "user_email_history"
FOR SELECT
TO authenticated
USING (
  "user_email_history"."user_id" in (
    select "users"."id"
    from "users"
    where lower("users"."email") = (select public.current_auth_email())
  )
);
