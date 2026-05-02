import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { comparePassword, hashPassword } from "../auth/passwords";
import { signAccessToken, signRefreshToken, verifyRefresh } from "../auth/tokens";
import {
  createUser,
  findUserByEmail,
  findUserById,
  incrementTokenVersion,
} from "../auth/userRepo";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many login attempts — try again in a minute",
      requestId: null,
    },
  },
});

function reqId(req: Request): string | null {
  return (req as Request & { id?: string }).id ?? null;
}

function authError(
  res: Response,
  status: number,
  code: string,
  message: string,
  requestId: string | null,
) {
  return res.status(status).json({ error: { code, message, requestId } });
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = registerSchema;

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

router.post("/register", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    authError(res, 400, "VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Invalid input", reqId(req));
    return;
  }

  const { email, password } = parsed.data;

  const existing = await findUserByEmail(email);
  if (existing) {
    authError(res, 409, "EMAIL_TAKEN", "An account with that email already exists", reqId(req));
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser({
    id: crypto.randomUUID(),
    email,
    passwordHash,
  });

  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id, user.tokenVersion);

  res.status(201).json({
    user: { id: user.id, email: user.email },
    accessToken,
    refreshToken,
  });
});

router.post("/login", loginLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    authError(res, 400, "VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Invalid input", reqId(req));
    return;
  }

  const { email, password } = parsed.data;

  const user = await findUserByEmail(email);
  if (!user || !user.passwordHash) {
    authError(res, 401, "INVALID_CREDENTIALS", "Invalid email or password", reqId(req));
    return;
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    authError(res, 401, "INVALID_CREDENTIALS", "Invalid email or password", reqId(req));
    return;
  }

  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id, user.tokenVersion);

  res.json({
    user: { id: user.id, email: user.email },
    accessToken,
    refreshToken,
  });
});

router.post("/refresh", async (req: Request, res: Response) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    authError(res, 400, "VALIDATION_ERROR", "refreshToken is required", reqId(req));
    return;
  }

  let payload: { sub: string; ver: number };
  try {
    payload = verifyRefresh(parsed.data.refreshToken);
  } catch {
    authError(res, 401, "TOKEN_INVALID", "Invalid or expired refresh token", reqId(req));
    return;
  }

  const row = await findUserById(payload.sub);
  if (!row) {
    authError(res, 401, "TOKEN_INVALID", "User not found", reqId(req));
    return;
  }

  if (row.user.tokenVersion !== payload.ver) {
    authError(res, 401, "TOKEN_REVOKED", "Refresh token has been revoked", reqId(req));
    return;
  }

  const accessToken = signAccessToken(row.user.id);
  const refreshToken = signRefreshToken(row.user.id, row.user.tokenVersion);

  res.json({ accessToken, refreshToken });
});

router.post("/logout", requireAuth, async (req: Request, res: Response) => {
  await incrementTokenVersion(req.user!.id);
  res.status(204).send();
});

router.post("/apple", (_req: Request, res: Response) => {
  res.status(501).json({
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Apple Sign-In is not yet implemented",
      requestId: null,
    },
  });
});

router.post("/google", (_req: Request, res: Response) => {
  res.status(501).json({
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Google Sign-In is not yet implemented",
      requestId: null,
    },
  });
});

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const row = await findUserById(req.user!.id);
  if (!row) {
    authError(res, 401, "UNAUTHORIZED", "User not found", reqId(req));
    return;
  }

  res.json({
    user: {
      id: row.user.id,
      email: row.user.email,
      createdAt: row.user.createdAt,
    },
    profile: row.profile,
  });
});

export default router;
