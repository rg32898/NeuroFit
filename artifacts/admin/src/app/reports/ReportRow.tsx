"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";

type Report = {
  id: string;
  category: string;
  message: string;
  status: string;
  gameItemId: string | null;
};

export function ReportRow({ report }: { report: Report }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "claim" | "resolve" | "dismiss") {
    setBusy(true);
    setError(null);
    try {
      if (action === "claim") {
        await api.post(`/proxy/admin/reports/${report.id}/claim`);
      } else {
        await api.post(`/proxy/admin/reports/${report.id}/resolve`, {
          resolution: action === "resolve" ? "resolved" : "dismissed",
        });
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded border border-slate-200 bg-white p-3 text-sm shadow-sm">
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span className="rounded bg-slate-100 px-1.5 py-0.5">
          {report.category}
        </span>
        <span className="font-mono">{report.id.slice(0, 6)}</span>
      </div>
      <p className="mb-2 text-slate-800">{report.message}</p>
      {report.gameItemId && (
        <Link
          href={`/items/${report.gameItemId}/edit`}
          className="mb-2 block text-xs text-blue-700 hover:underline"
        >
          → Edit item
        </Link>
      )}
      {error && <p className="mb-2 text-xs text-red-700">{error}</p>}
      <div className="flex gap-1">
        {report.status === "open" && (
          <button
            onClick={() => act("claim")}
            disabled={busy}
            className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-50"
          >
            Claim
          </button>
        )}
        {report.status !== "resolved" && report.status !== "dismissed" && (
          <>
            <button
              onClick={() => act("resolve")}
              disabled={busy}
              className="rounded bg-green-700 px-2 py-1 text-xs text-white disabled:opacity-50"
            >
              Resolve
            </button>
            <button
              onClick={() => act("dismiss")}
              disabled={busy}
              className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-50"
            >
              Dismiss
            </button>
          </>
        )}
      </div>
    </article>
  );
}
