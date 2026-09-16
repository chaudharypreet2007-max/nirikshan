import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminStats, adminListOrganizations } from "@/lib/admin.functions";
import { KpiCard, PageHeader, Panel, EmptyRow, StatusPill } from "@/components/admin-ui";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/overview")({
  head: () => ({
    meta: [
      { title: "Platform overview — Nirikshan AI admin" },
      { name: "description", content: "Government and business portal activity side by side for head administrators." },
      { property: "og:title", content: "Platform overview — Nirikshan AI admin" },
      { property: "og:description", content: "Switch between all, government and business platform activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Overview,
});

type Scope = "all" | "government" | "business";

function Overview() {
  const [scope, setScope] = useState<Scope>("all");
  const stats = useServerFn(adminStats);
  const listOrgs = useServerFn(adminListOrganizations);

  const { data } = useQuery({ queryKey: ["admin-stats"], queryFn: () => stats({ data: {} as never }) });
  const { data: orgs } = useQuery({
    queryKey: ["admin-orgs", scope],
    queryFn: () => listOrgs({ data: { scope } }),
  });

  const s = data ?? {};
  const showGov = scope !== "business";
  const showBiz = scope !== "government";

  return (
    <div className="space-y-6">
      <PageHeader title="Platform overview" description="Cross-portal activity across the whole Nirikshan AI estate." />

      <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="government">Government</TabsTrigger>
          <TabsTrigger value="business">Business</TabsTrigger>
        </TabsList>
      </Tabs>

      {showGov ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Government portal</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Government organisations" value={s["gov_organizations"]} />
            <KpiCard label="Government administrators" value={s["gov_admins"]} />
            <KpiCard label="Active inspectors" value={s["inspectors"]} />
            <KpiCard label="Inspections completed" value={s["gov_inspections"]} />
            <KpiCard label="Pending inspections" value={s["processing"]} tone="warning" />
            <KpiCard label="Violations detected" value={s["open_violations"]} tone="warning" />
            <KpiCard label="High-risk inspections" value={s["high_risk_inspections"]} tone="critical" />
            <KpiCard label="Supervisor reviews" value={s["total_reviews"]} />
          </div>
        </section>
      ) : null}

      {showBiz ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Business portal</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Organisations" value={s["business_organizations"]} />
            <KpiCard label="Manufacturers" value={s["manufacturers"]} />
            <KpiCard label="Retailers" value={s["retailers"]} />
            <KpiCard label="Inspection agencies" value={s["inspection_agencies"]} />
            <KpiCard label="Active business users" value={s["business_users"]} />
            <KpiCard label="Products registered" value={s["products"]} />
            <KpiCard label="Business inspections" value={s["business_inspections"]} />
            <KpiCard label="Compliant results" value={s["compliant"]} tone="positive" />
          </div>
        </section>
      ) : null}

      <Panel title="Organisations in scope">
        {(orgs ?? []).length === 0 ? (
          <EmptyRow label="No organisations registered in this scope." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-2 font-semibold">Organisation</th>
                  <th className="px-5 py-2 font-semibold">Type</th>
                  <th className="px-5 py-2 font-semibold">Jurisdiction</th>
                  <th className="px-5 py-2 font-semibold">Users</th>
                  <th className="px-5 py-2 font-semibold">Inspections</th>
                  <th className="px-5 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(orgs ?? []).map((o) => (
                  <tr key={o.id}>
                    <td className="px-5 py-3 font-medium">{o.name}</td>
                    <td className="px-5 py-3 capitalize text-muted-foreground">
                      {o.organization_type.replace(/_/g, " ")}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{o.jurisdiction ?? "—"}</td>
                    <td className="px-5 py-3 tabular-nums">{o.user_count}</td>
                    <td className="px-5 py-3 tabular-nums">{o.inspection_count}</td>
                    <td className="px-5 py-3">
                      <StatusPill status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
