import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  preferredName: text("preferred_name").notNull(),
  timezone: text("timezone").notNull(),
  sendTimeLocal: text("send_time_local").notNull(),
  interestMemoryText: text("interest_memory_text").notNull(),
  lastIssueSentAt: timestamp("last_issue_sent_at", { withTimezone: true })
});

export const newsletterItems = pgTable(
  "newsletter_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userSentAtIdx: index("newsletter_items_user_id_sent_at_idx").on(table.userId, table.sentAt),
    userUrlUnique: uniqueIndex("newsletter_items_user_id_url_unique").on(table.userId, table.url)
  })
);

export const processedWebhooks = pgTable(
  "processed_webhooks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(),
    webhookId: text("webhook_id").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    providerWebhookUnique: uniqueIndex("processed_webhooks_provider_webhook_id_unique").on(
      table.provider,
      table.webhookId
    ),
    processedAtIdx: index("processed_webhooks_processed_at_idx").on(table.processedAt)
  })
);

export const cronSelectionLeases = pgTable(
  "cron_selection_leases",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    leasedAt: timestamp("leased_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    leasedAtIdx: index("cron_selection_leases_leased_at_idx").on(table.leasedAt)
  })
);
