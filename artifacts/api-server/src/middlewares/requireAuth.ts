import { NextFunction, Request, Response } from "express";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { verifyAccess } from "../auth/tokens";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or malformed Authorization header",
        requestId: (req as Request & { id?: string }).id ?? null,
      },
    });
    return;
  }

  const token = header.slice(7);

  try {
    const payload = verifyAccess(token);
    req.user = { id: payload.sub };
    next();
  } catch (err) {
    const code =
      err instanceof TokenExpiredError ? "TOKEN_EXPIRED" : "TOKEN_INVALID";
    const message =
      err instanceof TokenExpiredError ? "Access token expired" : "Invalid access token";

    res.status(401).json({
      error: {
        code,
        message,
        requestId: (req as Request & { id?: string }).id ?? null,
      },
    });
  }
}
