import { z } from "zod";

/**
 * FR-12.x — admin console role hierarchy.
 *
 * Numeric ladder: user < author < reviewer < admin. requireRole(minRole) on
 * the server compares ranks so a higher role automatically satisfies any
 * lower requirement.
 */
export const ROLES = ["user", "author", "reviewer", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_RANK: Record<Role, number> = {
  user: 0,
  author: 1,
  reviewer: 2,
  admin: 3,
};

export function hasRole(actual: string, min: Role): boolean {
  const a = ROLE_RANK[actual as Role];
  if (typeof a !== "number") return false;
  return a >= ROLE_RANK[min];
}

export const roleSchema = z.enum(ROLES);

/* ---------- Game CRUD ---------- */

export const createGameSchema = z
  .object({
    slug: z
      .string()
      .min(2)
      .max(64)
      .regex(/^[a-z0-9-]+$/),
    title: z.string().min(1).max(120),
    domain: z.string().min(1).max(40),
    description: z.string().min(1).max(2000),
    averageDurationSec: z.number().int().min(10).max(3600),
    supportsRelaxed: z.boolean().optional(),
    isFreeTier: z.boolean().optional(),
    isPublished: z.boolean().optional(),
  })
  .strict();
export type CreateGameInput = z.infer<typeof createGameSchema>;

export const updateGameSchema = createGameSchema.partial().strict();
export type UpdateGameInput = z.infer<typeof updateGameSchema>;

/* ---------- Game item CRUD ---------- */

export const createItemSchema = z
  .object({
    gameId: z.string().min(1),
    payload: z.record(z.unknown()),
    difficultyBand: z.number().int().min(1).max(4),
  })
  .strict();
export type CreateItemInput = z.infer<typeof createItemSchema>;

export const updateItemSchema = z
  .object({
    payload: z.record(z.unknown()).optional(),
    difficultyBand: z.number().int().min(1).max(4).optional(),
  })
  .strict();
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

export const hotPatchItemSchema = z
  .object({
    payload: z.record(z.unknown()),
    note: z.string().max(500).optional(),
  })
  .strict();
export type HotPatchInput = z.infer<typeof hotPatchItemSchema>;

export const itemQuerySchema = z
  .object({
    gameId: z.string().optional(),
    status: z.enum(["draft", "published", "all"]).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();
export type ItemQuery = z.infer<typeof itemQuerySchema>;

/* ---------- Reports queue ---------- */

export const reportsQuerySchema = z
  .object({
    status: z.enum(["open", "claimed", "resolved", "dismissed"]).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();
export type ReportsQuery = z.infer<typeof reportsQuerySchema>;

export const resolveReportSchema = z
  .object({
    resolution: z.enum(["resolved", "dismissed"]),
    note: z.string().max(1000).optional(),
  })
  .strict();
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;

/* ---------- Audit feed ---------- */

export const auditQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(200).optional(),
    actorUserId: z.string().optional(),
    targetType: z.string().optional(),
  })
  .strict();
export type AuditQuery = z.infer<typeof auditQuerySchema>;
