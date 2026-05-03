import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.redirect(
    new URL("/admin/login", process.env.NEXT_PUBLIC_BASE_URL || "http://localhost"),
    303,
  );
  res.cookies.delete({ name: "admin_at", path: "/admin" });
  res.cookies.delete({ name: "admin_rt", path: "/admin" });
  return res;
}
