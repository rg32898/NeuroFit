import { apiFetch } from "@/lib/server-api";

type Entry = {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  let entries: Entry[] = [];
  let error: string | null = null;
  try {
    const data = await apiFetch<{ entries: Entry[] }>(
      "/api/admin/audit?limit=200",
    );
    entries = data.entries;
  } catch (err) {
    error =
      err instanceof Error
        ? err.message
        : "Audit feed is admin-only — your role doesn't have access.";
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Audit feed</h1>
      {error && (
        <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {error}
        </p>
      )}
      {!error && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Actor</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Target</th>
                <th className="px-3 py-2 font-medium">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                    No audit entries yet.
                  </td>
                </tr>
              )}
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-500">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono">
                    {e.actorUserId.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2">{e.action}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {e.targetType}/{e.targetId.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-slate-500">
                    {e.metadata ? JSON.stringify(e.metadata) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
