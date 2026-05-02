import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const supportTicketsTable = pgTable(
  "support_tickets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: text("status").default("open").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    byUserCreated: index("support_tickets_user_created_idx").on(
      t.userId,
      t.createdAt,
    ),
  }),
);

export type InsertSupportTicket = typeof supportTicketsTable.$inferInsert;
export type SupportTicket = typeof supportTicketsTable.$inferSelect;
