import {
  db,
  gamesTable,
  gameItemsTable,
  progressEventsTable,
  proficiencyScoresTable,
  type Game,
  type GameItem,
} from "@workspace/db";
import { and, eq, gte, inArray } from "drizzle-orm";

export type GameFilter = {
  domain?: string;
  isFreeTier?: boolean;
};

export async function listPublishedGames(filter: GameFilter): Promise<Game[]> {
  const conditions = [eq(gamesTable.isPublished, true)];
  if (filter.domain) conditions.push(eq(gamesTable.domain, filter.domain));
  if (typeof filter.isFreeTier === "boolean") {
    conditions.push(eq(gamesTable.isFreeTier, filter.isFreeTier));
  }
  return db
    .select()
    .from(gamesTable)
    .where(and(...conditions));
}

export async function getPublishedGameBySlug(
  slug: string,
): Promise<Game | null> {
  const [row] = await db
    .select()
    .from(gamesTable)
    .where(and(eq(gamesTable.slug, slug), eq(gamesTable.isPublished, true)));
  return row ?? null;
}

export async function getPublishedItemsForGame(
  gameId: string,
): Promise<GameItem[]> {
  return db
    .select()
    .from(gameItemsTable)
    .where(
      and(
        eq(gameItemsTable.gameId, gameId),
        eq(gameItemsTable.isPublished, true),
      ),
    );
}

export async function getRecentlyServedItemIds(
  userId: string,
  gameId: string,
  since: Date,
): Promise<Set<string>> {
  const rows = await db
    .select({ itemId: progressEventsTable.itemId })
    .from(progressEventsTable)
    .where(
      and(
        eq(progressEventsTable.userId, userId),
        eq(progressEventsTable.gameId, gameId),
        inArray(progressEventsTable.eventType, [
          "item_served",
          "item_completed",
        ]),
        gte(progressEventsTable.createdAt, since),
      ),
    );
  const ids = new Set<string>();
  for (const r of rows) {
    if (r.itemId) ids.add(r.itemId);
  }
  return ids;
}

export async function getProficiencyForUserDomain(
  userId: string,
  domain: string,
): Promise<number> {
  const [row] = await db
    .select()
    .from(proficiencyScoresTable)
    .where(
      and(
        eq(proficiencyScoresTable.userId, userId),
        eq(proficiencyScoresTable.domain, domain),
      ),
    );
  return row?.score ?? 2000;
}
