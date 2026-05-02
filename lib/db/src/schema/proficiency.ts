import { pgTable, text, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const proficiencyScoresTable = pgTable(
  "proficiency_scores",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    domain: text("domain").notNull(),
    score: integer("score").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.userId, t.domain)],
);

export type InsertProficiencyScore = typeof proficiencyScoresTable.$inferInsert;
export type ProficiencyScore = typeof proficiencyScoresTable.$inferSelect;
