import Link from "next/link";
import { apiFetch } from "@/lib/server-api";

type Game = {
  id: string;
  slug: string;
  title: string;
  domain: string;
  isPublished: boolean;
  averageDurationSec: number;
};

export const dynamic = "force-dynamic";

export default async function GamesPage() {
  const data = await apiFetch<{ games: Game[] }>("/api/admin/games");
  const games = data.games;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Games</h1>
        <Link
          href="/games/new"
          className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
        >
          Create game
        </Link>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Title</th>
              <th className="px-4 py-2 font-medium">Slug</th>
              <th className="px-4 py-2 font-medium">Domain</th>
              <th className="px-4 py-2 font-medium">Duration</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {games.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No games yet.
                </td>
              </tr>
            )}
            {games.map((g) => (
              <tr key={g.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link
                    href={`/games/${g.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {g.title}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-500">{g.slug}</td>
                <td className="px-4 py-2 text-slate-500">{g.domain}</td>
                <td className="px-4 py-2 text-slate-500">
                  {Math.round(g.averageDurationSec / 60)}m
                </td>
                <td className="px-4 py-2">
                  {g.isPublished ? (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                      Published
                    </span>
                  ) : (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      Draft
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
