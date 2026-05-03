import { NextFunction, Request, Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hasRole, type Role } from "@workspace/shared/admin";

declare global {
  namespace Express {
    interface Request {
      actor?: { id: string; role: Role };
    }
  }
}

/**
 * FR-12.x — gate a route by minimum role. Must be used AFTER `requireAuth`
 * so `req.user.id` is populated. Performs one DB lookup per request to
 * fetch the live role (no caching — role changes take effect immediately,
 * which matters for revoking a compromised author/reviewer account).
 */
export function requireRole(min: Role) {
  return async function requireRoleMw(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const userId = req.user?.id;
    const requestId = (req as Request & { id?: string }).id ?? null;

    if (!userId) {
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
          requestId,
        },
      });
      return;
    }

    const [row] = await db
      .select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!row) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "User not found", requestId },
      });
      return;
    }

    if (!hasRole(row.role, min)) {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: `Requires role: ${min} or higher`,
          requestId,
        },
      });
      return;
    }

    req.actor = { id: row.id, role: row.role as Role };
    next();
  };
}
