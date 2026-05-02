import { z } from "zod";

export const TICKET_CATEGORIES = [
  "bug",
  "billing",
  "account",
  "feedback",
  "data_request",
  "other",
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_STATUSES = [
  "open",
  "in_progress",
  "waiting_user",
  "resolved",
  "closed",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const createTicketSchema = z
  .object({
    category: z.enum(TICKET_CATEGORIES),
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(5000),
  })
  .strict();

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
