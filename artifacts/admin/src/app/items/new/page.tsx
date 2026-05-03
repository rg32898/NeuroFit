"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";

function NewItemInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gameId = search.get("gameId") ?? "";

  const [payload, setPayload] = useState('{\n  "prompt": "",\n  "answer": ""\n}');
  const [difficultyBand, setDifficultyBand] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      setBusy(false);
      setError("Payload is not valid JSON");
      return;
    }
    try {
      const res = await api.post<{ item: { id: string } }>(
        "/proxy/admin/items",
        { gameId, payload: parsed, difficultyBand },
      );
      router.push(`/items/${res.item.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">New item</h1>
      <form
        onSubmit={onSubmit}
        className="space-y-3 rounded-lg border border-slate-200 bg-white p-6"
      >
        <p className="text-xs text-slate-500">
          Game: <span className="font-mono">{gameId || "(none)"}</span>
        </p>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Difficulty band (1–4)</span>
          <input
            type="number"
            min={1}
            max={4}
            value={difficultyBand}
            onChange={(e) => setDifficultyBand(parseInt(e.target.value) || 2)}
            className="w-32 rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Payload (JSON)</span>
          <textarea
            required
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            rows={10}
            className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-xs"
          />
        </label>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={busy || !gameId}
          className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create draft"}
        </button>
      </form>
    </div>
  );
}

export default function NewItemPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <NewItemInner />
    </Suspense>
  );
}
