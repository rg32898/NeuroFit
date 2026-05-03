import { apiFetch } from "@/lib/server-api";
import { ItemEditor } from "./ItemEditor";

type Item = {
  id: string;
  gameId: string;
  payload: Record<string, unknown>;
  difficultyBand: number;
  version: number;
  isPublished: boolean;
  reviewedAt: string | null;
  reviewedById: string | null;
};

export const dynamic = "force-dynamic";

export default async function EditItemPage({
  params,
}: {
  params: { id: string };
}) {
  const { item } = await apiFetch<{ item: Item }>(
    `/api/admin/items/${params.id}`,
  );

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">
          Edit item{" "}
          <span className="font-mono text-sm text-slate-500">
            {item.id.slice(0, 8)}…
          </span>
        </h1>
        <span className="text-xs text-slate-500">
          Version v{item.version} · Band {item.difficultyBand}
        </span>
      </div>
      <ItemEditor item={item} />
    </div>
  );
}
