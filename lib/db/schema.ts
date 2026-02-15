import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  preferredName: text("preferred_name"),
  timezone: text("timezone").notNull(),
  sendTimeLocal: text("send_time_local").notNull(),
  interestMemoryText: text("interest_memory_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
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
    position: integer("position"),
    isDiscovery: boolean("is_discovery")
  },
  (table) => ({
    userSentAtIdx: index("newsletter_items_user_id_sent_at_idx").on(table.userId, table.sentAt),
    userUrlUnique: uniqueIndex("newsletter_items_user_id_url_unique").on(table.userId, table.url)
  })
);
