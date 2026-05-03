"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";

export function GamePublishToggle({
  gameId,
  isPublished,
}: {
  gameId: string;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/proxy/admin/games/${gameId}`, {
        isPublished: !isPublished,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Toggle failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        onClick={toggle}
        disabled={busy}
        className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
      >
        {isPublished ? "Unpublish" : "Publish"}
      </button>
    </div>
  );
}
