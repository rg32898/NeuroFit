import {
  db,
  profilesTable,
  proficiencyScoresTable,
  type Profile,
  type ProficiencyScore,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import type { ProficiencyScores } from "@workspace/shared/profile";

export async function getProfileByUserId(
  userId: string,
): Promise<Profile | null> {
  const [row] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));
  return row ?? null;
}

export async function upsertProfile(
  userId: string,
  data: Partial<{
    displayName: string;
    birthYear: number;
    focusDomain: string;
    relaxedMode: boolean;
    timerScale: number;
  }>,
): Promise<Profile> {
  const [row] = await db
    .insert(profilesTable)
    .values({ userId, ...data })
    .onConflictDoUpdate({
      target: profilesTable.userId,
      set: { ...data, updatedAt: new Date() },
    })
    .returning();
  return row!;
}

export async function getProficiencyScores(
  userId: string,
): Promise<ProficiencyScore[]> {
  return db
    .select()
    .from(proficiencyScoresTable)
    .where(eq(proficiencyScoresTable.userId, userId));
}

export async function upsertProficiencyScores(
  userId: string,
  scores: ProficiencyScores,
): Promise<ProficiencyScore[]> {
  const rows = Object.entries(scores).map(([domain, score]) => ({
    id: crypto.randomUUID(),
    userId,
    domain,
    score,
  }));

  const inserted: ProficiencyScore[] = [];
  for (const row of rows) {
    const [result] = await db
      .insert(proficiencyScoresTable)
      .values(row)
      .onConflictDoUpdate({
        target: [proficiencyScoresTable.userId, proficiencyScoresTable.domain],
        set: { score: row.score, updatedAt: new Date() },
      })
      .returning();
    if (result) inserted.push(result);
  }
  return inserted;
}
