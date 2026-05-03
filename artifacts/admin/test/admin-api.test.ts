import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Unit tests for the admin BFF logic — verifies that:
 *   1. The set-cookie route only issues a cookie when /admin/me succeeds
 *      (i.e. user actually has an admin console role).
 *   2. The proxy attaches the HttpOnly cookie as a Bearer header.
 *
 * We test the route handlers directly rather than spinning up Next.js so
 * the suite stays fast and deps-free.
 */

const cookieStore = new Map<string, { value: string }>();
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => cookieStore.get(name),
    set: (name: string, value: string) => cookieStore.set(name, { value }),
    delete: () => undefined,
  }),
}));

const upstream = vi.fn();
beforeEach(() => {
  cookieStore.clear();
  upstream.mockReset();
  vi.stubGlobal("fetch", upstream);
  process.env.ADMIN_API_INTERNAL_URL = "http://api.test";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BFF /api/auth/set-cookie", () => {
  it("rejects when /admin/me returns 403 (non-admin user)", async () => {
    upstream
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ accessToken: "at1", refreshToken: "rt1" }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 403 }));

    const { POST } = await import("../src/app/api/auth/set-cookie/route");
    const req = new Request("http://x/admin/api/auth/set-cookie", {
      method: "POST",
      body: JSON.stringify({ email: "user@neurofit.app", password: "abcdef" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(cookieStore.has("admin_at")).toBe(false);
  });

  it("issues HttpOnly cookies when /admin/me succeeds", async () => {
    upstream
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ accessToken: "at2", refreshToken: "rt2" }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ actor: { id: "u1", role: "reviewer" } }),
          { status: 200 },
        ),
      );

    const { POST } = await import("../src/app/api/auth/set-cookie/route");
    const req = new Request("http://x/admin/api/auth/set-cookie", {
      method: "POST",
      body: JSON.stringify({
        email: "reviewer@neurofit.app",
        password: "abcdef",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    // Cookie was set via NextResponse.cookies (not via the cookies() store
    // mock) — verify the Set-Cookie header instead.
    const setCookies = res.headers.getSetCookie();
    expect(setCookies.some((c) => c.startsWith("admin_at=at2"))).toBe(true);
    expect(setCookies.some((c) => c.includes("HttpOnly"))).toBe(true);
  });

  it("rejects malformed credentials with 400", async () => {
    const { POST } = await import("../src/app/api/auth/set-cookie/route");
    const req = new Request("http://x/admin/api/auth/set-cookie", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });
});

describe("BFF /api/proxy/[...path]", () => {
  it("forwards Bearer header from HttpOnly cookie", async () => {
    cookieStore.set("admin_at", { value: "secret-token" });
    upstream.mockResolvedValueOnce(
      new Response(JSON.stringify({ games: [] }), { status: 200 }),
    );

    const { GET } = await import("../src/app/api/proxy/[...path]/route");
    // Build a NextRequest-like object the route handler accepts.
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://x/admin/api/proxy/admin/games");
    const res = await GET(req, { params: { path: ["admin", "games"] } });

    expect(res.status).toBe(200);
    const call = upstream.mock.calls[0]!;
    expect(call[0]).toBe("http://api.test/api/admin/games");
    const headers = call[1].headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer secret-token");
  });

  it("forwards 403 from upstream when user lacks role", async () => {
    cookieStore.set("admin_at", { value: "author-token" });
    upstream.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: "FORBIDDEN", message: "requires reviewer" },
        }),
        { status: 403 },
      ),
    );

    const { POST } = await import("../src/app/api/proxy/[...path]/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(
      "http://x/admin/api/proxy/admin/items/x/publish",
      { method: "POST", body: "" },
    );
    const res = await POST(req, {
      params: { path: ["admin", "items", "x", "publish"] },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });
});
