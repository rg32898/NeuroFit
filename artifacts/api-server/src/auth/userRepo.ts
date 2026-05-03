import { db, usersTable, profilesTable } from "@workspace/db";
import type { Profile, User } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function findUserByEmail(email: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));
  return user ?? null;
}

export async function findUserById(
  userId: string,
): Promise<{ user: User; profile: Profile | null } | null> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!user) return null;

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));

  return { user, profile: profile ?? null };
}

export async function createUser(data: {
  id: string;
  email: string;
  passwordHash: string;
}): Promise<User> {
  const [user] = await db.insert(usersTable).values(data).returning();
  return user!;
}

export async function incrementTokenVersion(userId: string): Promise<number> {
  const [current] = await db
    .select({ tokenVersion: usersTable.tokenVersion })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  const next = (current?.tokenVersion ?? 0) + 1;

  await db
    .update(usersTable)
    .set({ tokenVersion: next })
    .where(eq(usersTable.id, userId));

  return next;
}

/**
 * FR-6.x — schedule a soft-delete with a 14-day reverse window. Idempotent:
 * if `deletionScheduledAt` is already set, returns the existing timestamp
 * (so multiple device taps don't extend the grace period silently).
 */
export async function scheduleDeletion(
  userId: string,
  now: Date = new Date(),
): Promise<{ scheduledAt: Date; purgeAt: Date } | null> {
  const [existing] = await db
    .select({ deletionScheduledAt: usersTable.deletionScheduledAt })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!existing) return null;

  const scheduledAt = existing.deletionScheduledAt ?? now;

  if (!existing.deletionScheduledAt) {
    await db
      .update(usersTable)
      .set({ deletionScheduledAt: scheduledAt })
      .where(eq(usersTable.id, userId));
  }

  const purgeAt = new Date(scheduledAt.getTime() + 14 * 24 * 60 * 60 * 1000);
  return { scheduledAt, purgeAt };
}

/** Clears the 14-day deletion window (user changed their mind). */
export async function cancelDeletion(userId: string): Promise<boolean> {
  const result = await db
    .update(usersTable)
    .set({ deletionScheduledAt: null })
    .where(eq(usersTable.id, userId))
    .returning({ id: usersTable.id });
  return result.length > 0;
}

export async function getDeletionStatus(
  userId: string,
): Promise<{ scheduledAt: Date | null; purgeAt: Date | null }> {
  const [row] = await db
    .select({ deletionScheduledAt: usersTable.deletionScheduledAt })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  const scheduledAt = row?.deletionScheduledAt ?? null;
  return {
    scheduledAt,
    purgeAt: scheduledAt
      ? new Date(scheduledAt.getTime() + 14 * 24 * 60 * 60 * 1000)
      : null,
  };
}
