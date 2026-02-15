CREATE TABLE "newsletter_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"timezone" text NOT NULL,
	"send_time_local" text NOT NULL,
	"interest_memory_text" text NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "newsletter_items" ADD CONSTRAINT "newsletter_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "newsletter_items_user_id_sent_at_idx" ON "newsletter_items" USING btree ("user_id","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_items_user_id_url_unique" ON "newsletter_items" USING btree ("user_id","url");