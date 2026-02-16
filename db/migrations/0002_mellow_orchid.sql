ALTER TABLE "users" ADD COLUMN "preferred_name" text;
--> statement-breakpoint
UPDATE "users"
SET "preferred_name" = split_part("email", '@', 1)
WHERE "preferred_name" IS NULL OR btrim("preferred_name") = '';
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "preferred_name" SET NOT NULL;
