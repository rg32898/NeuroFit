import Link from "next/link";
import { apiFetch } from "@/lib/server-api";
import { GamePublishToggle } from "./GamePublishToggle";

type Game = {
  id: string;
  slug: string;
  title: string;
  domain: string;
  description: string;
  isPublished: boolean;
  averageDurationSec: number;
};

type Item = {
  id: string;
  difficultyBand: number;
  version: number;
  isPublished: boolean;
  reviewedAt: string | null;
};

export const dynamic = "force-dynamic";

export default async function GameDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { status?: "draft" | "published" | "all" };
}) {
  const status = searchParams.status ?? "all";
  const [{ game }, { items }] = await Promise.all([
    apiFetch<{ game: Game }>(`/api/admin/games/${params.id}`),
    apiFetch<{ items: Item[] }>(
      `/api/admin/items?gameId=${params.id}&status=${status}`,
    ),
  ]);

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{game.title}</h1>
          <p className="text-sm text-slate-500">
            {game.slug} · {game.domain} ·{" "}
            {Math.round(game.averageDurationSec / 60)}m avg
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GamePublishToggle gameId={game.id} isPublished={game.isPublished} />
          <Link
            href={`/items/new?gameId=${game.id}`}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
          >
            New item
          </Link>
        </div>
      </div>

      <p className="mb-4 max-w-3xl text-sm text-slate-700">{game.description}</p>

      <div className="mb-3 flex gap-2 text-sm">
        {(["all", "draft", "published"] as const).map((s) => (
          <Link
            key={s}
            href={`/games/${game.id}?status=${s}`}
            className={`rounded px-3 py-1 ${
              status === s
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200"
            }`}
          >
            {s[0]?.toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Item ID</th>
              <th className="px-4 py-2 font-medium">Band</th>
              <th className="px-4 py-2 font-medium">Version</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Reviewed</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No items.
                </td>
              </tr>
            )}
            {items.map((it) => (
              <tr key={it.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-xs">
                  {it.id.slice(0, 8)}…
                </td>
                <td className="px-4 py-2">{it.difficultyBand}</td>
                <td className="px-4 py-2">v{it.version}</td>
                <td className="px-4 py-2">
                  {it.isPublished ? (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                      Published
                    </span>
                  ) : (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      Draft
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-slate-500">
                  {it.reviewedAt
                    ? new Date(it.reviewedAt).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/items/${it.id}/edit`}
                    className="text-sm text-slate-900 hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
