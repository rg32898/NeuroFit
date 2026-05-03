import Link from "next/link";
import { cookies } from "next/headers";

export function Nav() {
  const isAuthed = cookies().get("admin_at")?.value;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/games" className="text-lg font-semibold tracking-tight">
          NeuroFit Admin
        </Link>
        {isAuthed ? (
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/games" className="hover:underline">
              Games
            </Link>
            <Link href="/reports" className="hover:underline">
              Reports
            </Link>
            <Link href="/audit" className="hover:underline">
              Audit
            </Link>
            <form action="/admin/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100"
              >
                Sign out
              </button>
            </form>
          </nav>
        ) : (
          <Link
            href="/login"
            className="text-sm text-slate-500 hover:underline"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
