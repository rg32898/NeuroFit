"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";

type Item = {
  id: string;
  payload: Record<string, unknown>;
  difficultyBand: number;
  version: number;
  isPublished: boolean;
};

export function ItemEditor({ item }: { item: Item }) {
  const router = useRouter();
  const [payload, setPayload] = useState(JSON.stringify(item.payload, null, 2));
  const [band, setBand] = useState(item.difficultyBand);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function parsePayload(): Record<string, unknown> | null {
    try {
      return JSON.parse(payload);
    } catch {
      setError("Payload is not valid JSON");
      return null;
    }
  }

  async function saveDraft() {
    setBusy(true);
    setError(null);
    setMsg(null);
    const p = parsePayload();
    if (!p) return setBusy(false);
    try {
      await api.patch(`/proxy/admin/items/${item.id}`, {
        payload: p,
        difficultyBand: band,
      });
      setMsg("Draft saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await api.post(`/proxy/admin/items/${item.id}/publish`);
      setMsg("Published.");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/proxy/admin/items/${item.id}/unpublish`);
      setMsg("Unpublished.");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unpublish failed");
    } finally {
      setBusy(false);
    }
  }

  async function hotPatch() {
    setBusy(true);
    setError(null);
    setMsg(null);
    const p = parsePayload();
    if (!p) return setBusy(false);
    try {
      const res = await api.post<{ item: { version: number } }>(
        `/proxy/admin/items/${item.id}/hot-patch`,
        { payload: p, note: note || undefined },
      );
      setMsg(`Hot-patched to v${res.item.version}. Mobile picks this up on next refresh.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Hot-patch failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-2 text-xs">
        {item.isPublished ? (
          <span className="rounded bg-green-100 px-2 py-0.5 text-green-800">
            Published
          </span>
        ) : (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">
            Draft
          </span>
        )}
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Difficulty band</span>
        <input
          type="number"
          min={1}
          max={4}
          value={band}
          onChange={(e) => setBand(parseInt(e.target.value) || 1)}
          className="w-24 rounded border border-slate-300 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Payload (JSON)</span>
        <textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          rows={14}
          className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-xs"
        />
      </label>

      {item.isPublished && (
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Hot-patch note (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
            placeholder="Why this change?"
          />
        </label>
      )}

      {error && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>
      )}
      {msg && (
        <p className="rounded bg-green-50 p-2 text-sm text-green-800">{msg}</p>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        {!item.isPublished && (
          <>
            <button
              onClick={saveDraft}
              disabled={busy}
              className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 disabled:opacity-50"
            >
              Save draft
            </button>
            <button
              onClick={publish}
              disabled={busy}
              className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Publish (reviewer only)
            </button>
          </>
        )}
        {item.isPublished && (
          <>
            <button
              onClick={hotPatch}
              disabled={busy}
              className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Hot-patch v{item.version} → v{item.version + 1}
            </button>
            <button
              onClick={unpublish}
              disabled={busy}
              className="rounded border border-amber-300 px-3 py-2 text-sm text-amber-800 hover:bg-amber-50 disabled:opacity-50"
            >
              Unpublish
            </button>
          </>
        )}
      </div>
    </div>
  );
}
