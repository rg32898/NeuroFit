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
