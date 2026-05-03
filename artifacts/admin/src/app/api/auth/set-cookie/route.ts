import { NextResponse } from "next/server";
import { z } from "zod";
import { apiBase } from "@/lib/server-api";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

/**
 * BFF login — exchanges the user's email/password against the api-server's
 * /api/auth/login, then stows the access token in an HttpOnly cookie. The
 * browser NEVER sees the access token (FR-12.1, defence-in-depth against
 * XSS). The refresh token is also stowed for silent refresh.
 */
export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid credentials" } },
      { status: 400 },
    );
  }

  const upstream = await fetch(`${apiBase()}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
  const data = await upstream.json().catch(() => null);
  if (!upstream.ok || !data?.accessToken) {
    return NextResponse.json(
      data ?? {
        error: { code: "UPSTREAM_ERROR", message: "Login failed" },
      },
      { status: upstream.status || 502 },
    );
  }

  // Verify the user has a console role before issuing the cookie. Saves a
  // round trip on every page load and gives a clearer error for ordinary
  // users who shouldn't be here at all.
  const meRes = await fetch(`${apiBase()}/api/admin/me`, {
    headers: { authorization: `Bearer ${data.accessToken}` },
  });
  if (!meRes.ok) {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "This account does not have admin console access.",
        },
      },
      { status: 403 },
    );
  }

  const secure = process.env.COOKIE_SECURE === "true";
  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_at", data.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/admin",
    maxAge: 60 * 60, // ~1h, matches the access TTL
  });
  if (data.refreshToken) {
    res.cookies.set("admin_rt", data.refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/admin",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}
