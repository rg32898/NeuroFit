import {
  db,
  supportTicketsTable,
  type SupportTicket,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { TicketCategory } from "@workspace/shared/support";

export type CreateTicketInput = {
  userId: string;
  category: TicketCategory;
  subject: string;
  body: string;
};

export async function createSupportTicket(
  input: CreateTicketInput,
): Promise<SupportTicket> {
  const [row] = await db
    .insert(supportTicketsTable)
    .values({
      id: crypto.randomUUID(),
      userId: input.userId,
      category: input.category,
      subject: input.subject,
      body: input.body,
      updatedAt: new Date(),
    })
    .returning();
  return row!;
}

/**
 * Fetch a ticket BUT only when it belongs to `userId`. Returning null for
 * "not found" and "found but owned by someone else" together prevents an
 * authenticated user from probing other users' ticket ids by id-enumeration.
 */
export async function findTicketByIdForUser(
  ticketId: string,
  userId: string,
): Promise<SupportTicket | null> {
  const [row] = await db
    .select()
    .from(supportTicketsTable)
    .where(
      and(
        eq(supportTicketsTable.id, ticketId),
        eq(supportTicketsTable.userId, userId),
      ),
    );
  return row ?? null;
}
