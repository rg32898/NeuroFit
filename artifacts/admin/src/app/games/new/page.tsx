"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";

export default function NewGamePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    slug: "",
    title: "",
    domain: "memory",
    description: "",
    averageDurationSec: 180,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ game: { id: string } }>(
        "/proxy/admin/games",
        form,
      );
      router.push(`/games/${res.game.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 text-xl font-semibold">Create game</h1>
      <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-6">
        {[
          { k: "slug", label: "Slug (kebab-case)" },
          { k: "title", label: "Title" },
          { k: "domain", label: "Domain (memory/attention/…)" },
        ].map(({ k, label }) => (
          <label key={k} className="block text-sm">
            <span className="mb-1 block text-slate-600">{label}</span>
            <input
              required
              value={(form as Record<string, unknown>)[k] as string}
              onChange={(e) =>
                update(k as keyof typeof form, e.target.value as never)
              }
              className="w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
        ))}
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Description</span>
          <textarea
            required
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={3}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">
            Average duration (seconds)
          </span>
          <input
            type="number"
            min={10}
            max={3600}
            value={form.averageDurationSec}
            onChange={(e) =>
              update("averageDurationSec", parseInt(e.target.value) || 0)
            }
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create"}
        </button>
      </form>
    </div>
  );
}
