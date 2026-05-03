import { randomUUID } from "node:crypto";
import {
  db,
  gamesTable,
  gameItemsTable,
  contentReportsTable,
  auditLogsTable,
  type Game,
  type GameItem,
  type ContentReport,
  type AuditLog,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import type {
  CreateGameInput,
  UpdateGameInput,
  CreateItemInput,
  UpdateItemInput,
  HotPatchInput,
  ItemQuery,
  ReportsQuery,
  ResolveReportInput,
  AuditQuery,
} from "@workspace/shared/admin";

/* ---------- Audit log ---------- */

export async function recordAudit(entry: {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}): Promise<AuditLog> {
  const [row] = await db
    .insert(auditLogsTable)
    .values({
      id: randomUUID(),
      actorUserId: entry.actorUserId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata ?? null,
    })
    .returning();
  return row!;
}

export async function listAudit(q: AuditQuery): Promise<AuditLog[]> {
  const conds = [];
  if (q.actorUserId) conds.push(eq(auditLogsTable.actorUserId, q.actorUserId));
  if (q.targetType) conds.push(eq(auditLogsTable.targetType, q.targetType));
  const where = conds.length ? and(...conds) : undefined;
  return db
    .select()
    .from(auditLogsTable)
    .where(where)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(q.limit ?? 100);
}

/* ---------- Games ---------- */

export async function listAllGames(): Promise<Game[]> {
  return db.select().from(gamesTable).orderBy(desc(gamesTable.createdAt));
}

export async function getGameById(id: string): Promise<Game | null> {
  const [row] = await db.select().from(gamesTable).where(eq(gamesTable.id, id));
  return row ?? null;
}

export async function createGame(input: CreateGameInput): Promise<Game> {
  const [row] = await db
    .insert(gamesTable)
    .values({
      id: randomUUID(),
      slug: input.slug,
      title: input.title,
      domain: input.domain,
      description: input.description,
      averageDurationSec: input.averageDurationSec,
      supportsRelaxed: input.supportsRelaxed ?? true,
      isFreeTier: input.isFreeTier ?? false,
      isPublished: input.isPublished ?? false,
    })
    .returning();
  return row!;
}

export async function updateGame(
  id: string,
  patch: UpdateGameInput,
): Promise<Game | null> {
  const [row] = await db
    .update(gamesTable)
    .set(patch)
    .where(eq(gamesTable.id, id))
    .returning();
  return row ?? null;
}

export async function deleteGame(id: string): Promise<boolean> {
  const rows = await db
    .delete(gamesTable)
    .where(eq(gamesTable.id, id))
    .returning({ id: gamesTable.id });
  return rows.length > 0;
}

/* ---------- Game items ---------- */

export async function listItems(q: ItemQuery): Promise<GameItem[]> {
  const conds = [];
  if (q.gameId) conds.push(eq(gameItemsTable.gameId, q.gameId));
  if (q.status === "draft") conds.push(eq(gameItemsTable.isPublished, false));
  if (q.status === "published")
    conds.push(eq(gameItemsTable.isPublished, true));
  const where = conds.length ? and(...conds) : undefined;
  return db
    .select()
    .from(gameItemsTable)
    .where(where)
    .orderBy(desc(gameItemsTable.createdAt))
    .limit(q.limit ?? 100);
}

export async function getItemById(id: string): Promise<GameItem | null> {
  const [row] = await db
    .select()
    .from(gameItemsTable)
    .where(eq(gameItemsTable.id, id));
  return row ?? null;
}

export async function createItem(input: CreateItemInput): Promise<GameItem> {
  const [row] = await db
    .insert(gameItemsTable)
    .values({
      id: randomUUID(),
      gameId: input.gameId,
      payload: input.payload,
      difficultyBand: input.difficultyBand,
      version: 1,
      isPublished: false,
    })
    .returning();
  return row!;
}

export async function updateItemDraft(
  id: string,
  patch: UpdateItemInput,
): Promise<GameItem | null> {
  const existing = await getItemById(id);
  if (!existing) return null;
  if (existing.isPublished) {
    // Once published, edits go through hot-patch which bumps version. Reject
    // direct draft edits to a published item.
    return null;
  }
  const [row] = await db
    .update(gameItemsTable)
    .set({
      ...(patch.payload ? { payload: patch.payload } : {}),
      ...(typeof patch.difficultyBand === "number"
        ? { difficultyBand: patch.difficultyBand }
        : {}),
    })
    .where(eq(gameItemsTable.id, id))
    .returning();
  return row ?? null;
}

export async function deleteItem(id: string): Promise<boolean> {
  const rows = await db
    .delete(gameItemsTable)
    .where(eq(gameItemsTable.id, id))
    .returning({ id: gameItemsTable.id });
  return rows.length > 0;
}

/**
 * FR-12.2 / FR-12.6 — only a reviewer+ can flip isPublished true. The route
 * layer enforces the role; this function is the durable write. Records the
 * reviewer id + timestamp on the row itself for cheap audit.
 */
export async function publishItem(
  id: string,
  reviewerId: string,
): Promise<GameItem | null> {
  const [row] = await db
    .update(gameItemsTable)
    .set({
      isPublished: true,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    })
    .where(eq(gameItemsTable.id, id))
    .returning();
  return row ?? null;
}

export async function unpublishItem(id: string): Promise<GameItem | null> {
  const [row] = await db
    .update(gameItemsTable)
    .set({ isPublished: false })
    .where(eq(gameItemsTable.id, id))
    .returning();
  return row ?? null;
}

/**
 * FR-12.3 — hot-patch a published item without an app-store update. Bumps
 * `version` and refreshes reviewer fields. Mobile clients pick this up on
 * the next catalogue refresh.
 */
export async function hotPatchItem(
  id: string,
  reviewerId: string,
  input: HotPatchInput,
): Promise<GameItem | null> {
  const existing = await getItemById(id);
  if (!existing) return null;
  const [row] = await db
    .update(gameItemsTable)
    .set({
      payload: input.payload,
      version: (existing.version ?? 1) + 1,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      isPublished: true,
    })
    .where(eq(gameItemsTable.id, id))
    .returning();
  return row ?? null;
}

/* ---------- Reports queue ---------- */

export async function listReports(q: ReportsQuery): Promise<ContentReport[]> {
  const conds = [];
  if (q.status) conds.push(eq(contentReportsTable.status, q.status));
  const where = conds.length ? and(...conds) : undefined;
  return db
    .select()
    .from(contentReportsTable)
    .where(where)
    .orderBy(desc(contentReportsTable.createdAt))
    .limit(q.limit ?? 100);
}

export async function claimReport(
  id: string,
  reviewerId: string,
): Promise<ContentReport | null> {
  const [row] = await db
    .update(contentReportsTable)
    .set({
      status: "claimed",
      claimedById: reviewerId,
      claimedAt: new Date(),
    })
    .where(eq(contentReportsTable.id, id))
    .returning();
  return row ?? null;
}

export async function resolveReport(
  id: string,
  input: ResolveReportInput,
): Promise<ContentReport | null> {
  const [row] = await db
    .update(contentReportsTable)
    .set({
      status: input.resolution,
      resolutionNote: input.note ?? null,
      resolvedAt: new Date(),
    })
    .where(eq(contentReportsTable.id, id))
    .returning();
  return row ?? null;
}
