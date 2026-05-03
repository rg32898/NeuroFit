import { apiFetch } from "@/lib/server-api";
import { ReportRow } from "./ReportRow";

type Report = {
  id: string;
  reporterId: string;
  gameItemId: string | null;
  category: string;
  message: string;
  status: "open" | "claimed" | "resolved" | "dismissed";
  claimedById: string | null;
  createdAt: string;
};

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [open, claimed, resolved] = await Promise.all([
    apiFetch<{ reports: Report[] }>("/api/admin/reports?status=open"),
    apiFetch<{ reports: Report[] }>("/api/admin/reports?status=claimed"),
    apiFetch<{ reports: Report[] }>("/api/admin/reports?status=resolved"),
  ]);

  const cols: { title: string; tone: string; reports: Report[] }[] = [
    { title: "Open", tone: "bg-amber-50", reports: open.reports },
    { title: "Claimed", tone: "bg-blue-50", reports: claimed.reports },
    { title: "Resolved", tone: "bg-green-50", reports: resolved.reports },
  ];

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Reports queue</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        {cols.map((col) => (
          <section
            key={col.title}
            className={`rounded-lg border border-slate-200 ${col.tone} p-3`}
          >
            <h2 className="mb-2 text-sm font-semibold text-slate-700">
              {col.title}{" "}
              <span className="text-xs text-slate-500">
                ({col.reports.length})
              </span>
            </h2>
            <div className="space-y-2">
              {col.reports.length === 0 && (
                <p className="text-xs text-slate-500">Empty.</p>
              )}
              {col.reports.map((r) => (
                <ReportRow key={r.id} report={r} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
