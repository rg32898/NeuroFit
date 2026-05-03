import { NextRequest, NextResponse } from "next/server";

/**
 * FR-12.1 — every page except /login requires the `admin_at` HttpOnly
 * cookie. Tokens never reach the browser; this middleware just checks
 * presence. Role gating happens server-side on the api-server (defence in
 * depth — never trust the client to enforce roles).
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public: the login screen and its BFF route
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/set-cookie") ||
    pathname.startsWith("/api/auth/logout")
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("admin_at")?.value;
  if (!cookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Skip Next.js internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
