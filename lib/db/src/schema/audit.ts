import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * FR-12.5 admin audit log — append-only feed of every privileged action.
 * Indexed by createdAt for the /admin/audit reverse-chronological feed and
 * by (targetType,targetId) for per-entity history.
 */
export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => usersTable.id),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    createdAtIdx: index("audit_logs_created_at_idx").on(t.createdAt),
    targetIdx: index("audit_logs_target_idx").on(t.targetType, t.targetId),
  }),
);

export type InsertAuditLog = typeof auditLogsTable.$inferInsert;
export type AuditLog = typeof auditLogsTable.$inferSelect;
