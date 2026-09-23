import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminStats, adminListAudit } from "@/lib/admin.functions";
import { KpiCard, PageHeader, Panel, EmptyRow } from "@/components/admin-ui";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — Nirikshan AI" },
      { name: "description", content: "Platform-wide key indicators for Nirikshan AI head administrators." },
      { property: "og:title", content: "Admin dashboard — Nirikshan AI" },
      { property: "og:description", content: "Users, organisations, products, inspections and violations at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const stats = useServerFn(adminStats);
  const audit = useServerFn(adminListAudit);

  const { data, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: () => stats() });
  const { data: logs } = useQuery({ queryKey: ["admin-audit"], queryFn: () => audit() });

  const s = data ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform dashboard"
        description="Everything happening across the government enforcement and business compliance portals."
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading platform figures…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Total users" value={s["total_users"]} to="/admin/users" />
            <KpiCard label="Government users" value={s["government_users"]} to="/admin/government" />
            <KpiCard label="Business users" value={s["business_users"]} to="/admin/business" />
            <KpiCard label="Inspectors" value={s["inspectors"]} to="/admin/government" />
            <KpiCard label="Organisations" value={s["organizations"]} hint="Government and business" to="/admin/overview" />
            <KpiCard label="Businesses" value={s["business_organizations"]} to="/admin/business" />
            <KpiCard label="Products" value={s["products"]} to="/admin/products" />
            <KpiCard label="Inspections" value={s["inspections"]} to="/admin/inspections" />
            <KpiCard label="Compliant" value={s["compliant"]} tone="positive" to="/admin/inspections" />
            <KpiCard label="Non-compliant" value={s["non_compliant"]} tone="critical" to="/admin/inspections" />
            <KpiCard label="Pending reviews" value={s["pending_reviews"]} tone="warning" to="/admin/inspections" />
            <KpiCard label="Open violations" value={s["open_violations"]} tone="warning" to="/admin/inspections" />
            <KpiCard label="High-risk inspections" value={s["high_risk_inspections"]} tone="critical" to="/admin/inspections" />
            <KpiCard label="Suspended accounts" value={s["suspended_accounts"]} tone="warning" to="/admin/users" />
            <KpiCard label="Active organisations" value={s["active_organizations"]} tone="positive" to="/admin/overview" />
            <KpiCard label="Needs review" value={s["needs_review"]} tone="warning" to="/admin/inspections" />

          </div>

          <Panel title="Compliance split">
            <div className="space-y-3 px-5 py-4">
              {[
                { label: "Compliant", value: Number(s["compliant"] ?? 0), className: "bg-success" },
                { label: "Needs review", value: Number(s["needs_review"] ?? 0), className: "bg-warning" },
                { label: "Non-compliant", value: Number(s["non_compliant"] ?? 0), className: "bg-destructive" },
              ].map((row) => {
                const total = Math.max(Number(s["inspections"] ?? 0), 1);
                const pct = Math.round((row.value / total) * 100);
                return (
                  <div key={row.label}>
                    <div className="flex justify-between text-sm">
                      <span>{row.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {row.value} · {pct}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full ${row.className}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </>
      )}

      <Panel title="Recent platform activity">
        {(logs ?? []).length === 0 ? (
          <EmptyRow label="No recorded activity yet." />
        ) : (
          <ul className="divide-y divide-border">
            {(logs ?? []).slice(0, 15).map((log) => (
              <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="font-medium capitalize">{log.action.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground">
                  {log.actor} · {new Date(log.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
