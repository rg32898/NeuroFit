import { NextRequest, NextResponse } from "next/server";
import { apiBase } from "@/lib/server-api";
import { cookies } from "next/headers";

/**
 * Generic admin BFF proxy. The browser calls /admin/api/proxy/admin/games,
 * this handler attaches the HttpOnly access token cookie as a Bearer
 * header and forwards to the upstream api-server. Keeps tokens out of the
 * browser entirely.
 */
async function forward(
  req: NextRequest,
  ctx: { params: { path: string[] } },
) {
  const at = cookies().get("admin_at")?.value;
  const upstreamPath = "/" + ctx.params.path.join("/");
  const url = `${apiBase()}/api${upstreamPath}${req.nextUrl.search}`;

  const headers = new Headers();
  headers.set("content-type", "application/json");
  if (at) headers.set("authorization", `Bearer ${at}`);

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  const upstream = await fetch(url, init);
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": "application/json" },
  });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;
export const PUT = forward;
