import { sql } from "drizzle-orm";
import { date, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  preferredName: text("preferred_name").notNull(),
  timezone: text("timezone").notNull(),
  sendTimeLocal: text("send_time_local").notNull(),
  sendTimeLocalMinute: integer("send_time_local_minute")
    .generatedAlwaysAs(sql`((split_part(send_time_local, ':', 1)::int * 60) + split_part(send_time_local, ':', 2)::int)`),
  interestMemoryText: text("interest_memory_text").notNull(),
  lastIssueSentAt: timestamp("last_issue_sent_at", { withTimezone: true }),
  lastReflectionAt: timestamp("last_reflection_at", { withTimezone: true }),
  sentUrlBloomBits: text("sent_url_bloom_bits")
}, (table) => ({
  sendTimeLocalMinuteIdx: index("users_send_time_local_minute_idx").on(table.sendTimeLocalMinute)
}));

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

export const outboundSendIdempotency = pgTable(
  "outbound_send_idempotency",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    localIssueDate: date("local_issue_date").notNull(),
    issueVariant: text("issue_variant").notNull().default("daily"),
    status: text("status").notNull().default("processing"),
    providerMessageId: text("provider_message_id"),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    idempotencyKeyUnique: uniqueIndex("outbound_send_idempotency_key_unique").on(table.idempotencyKey),
    userLocalDateIdx: index("outbound_send_idempotency_user_local_date_idx").on(table.userId, table.localIssueDate),
    statusIdx: index("outbound_send_idempotency_status_idx").on(table.status)
  })
);

export const userEmailHistory = pgTable(
  "user_email_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    subject: text("subject"),
    bodyText: text("body_text").notNull(),
    providerMessageId: text("provider_message_id"),
    issueVariant: text("issue_variant"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    userKindCreatedAtIdx: index("user_email_history_user_kind_created_at_idx").on(table.userId, table.kind, table.createdAt)
  })
);

export const adminAlertState = pgTable(
  "admin_alert_state",
  {
    alertKey: text("alert_key").primaryKey(),
    kind: text("kind").notNull(),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }).notNull(),
    sendCount: integer("send_count").notNull().default(1),
    lastPayloadHash: text("last_payload_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    kindIdx: index("admin_alert_state_kind_idx").on(table.kind),
    lastSentAtIdx: index("admin_alert_state_last_sent_at_idx").on(table.lastSentAt)
  })
);
