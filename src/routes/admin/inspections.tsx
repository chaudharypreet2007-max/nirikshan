import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListInspections } from "@/lib/admin.functions";
import { PageHeader, Panel, EmptyRow, StatusPill } from "@/components/admin-ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/inspections")({
  head: () => ({
    meta: [
      { title: "Inspection management — Nirikshan AI admin" },
      {
        name: "description",
        content: "Platform-wide inspection records with portal, risk and compliance filters.",
      },
      { property: "og:title", content: "Inspection management — Nirikshan AI admin" },
      {
        property: "og:description",
        content: "Every inspection across both portals, with full audit logging.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InspectionsPage,
});

function InspectionsPage() {
  const listInspections = useServerFn(adminListInspections);
  const [search, setSearch] = useState("");
  const [portal, setPortal] = useState("all");
  const [status, setStatus] = useState("all");
  const [risk, setRisk] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-inspections", search, portal, status, risk, from, to],
    queryFn: () =>
      listInspections({
        data: {
          search,
          portal,
          status,
          risk,
          ...(from ? { from: new Date(from).toISOString() } : {}),
          ...(to ? { to: new Date(`${to}T23:59:59`).toISOString() } : {}),
        },
      }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inspection management"
        description="Authorised platform-level visibility of every inspection. Each view is written to the audit trail."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Input
          placeholder="Search product, inspector, location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Pick
          value={portal}
          onChange={setPortal}
          options={{ all: "All portals", government: "Government", private: "Business" }}
        />
        <Pick
          value={status}
          onChange={setStatus}
          options={{
            all: "All results",
            compliant: "Compliant",
            needs_review: "Needs review",
            non_compliant: "Non-compliant",
            processing: "Processing",
          }}
        />
        <Pick
          value={risk}
          onChange={setRisk}
          options={{ all: "All risk levels", high: "High", medium: "Medium", low: "Low" }}
        />
        <div className="space-y-1.5">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <Panel title={`Inspections (${data?.length ?? 0})`}>
        {isLoading ? (
          <EmptyRow label="Loading inspections…" />
        ) : (data ?? []).length === 0 ? (
          <EmptyRow label="No inspections match these filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-2 font-semibold">Inspection</th>
                  <th className="px-5 py-2 font-semibold">Product</th>
                  <th className="px-5 py-2 font-semibold">Inspector</th>
                  <th className="px-5 py-2 font-semibold">Organisation</th>
                  <th className="px-5 py-2 font-semibold">Date</th>
                  <th className="px-5 py-2 font-semibold">Location</th>
                  <th className="px-5 py-2 font-semibold">Score</th>
                  <th className="px-5 py-2 font-semibold">Violations</th>
                  <th className="px-5 py-2 font-semibold">Risk</th>
                  <th className="px-5 py-2 font-semibold">Result</th>
                  <th className="px-5 py-2 font-semibold">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-3">
                      <Link
                        to="/app/inspections/$inspectionId"
                        params={{ inspectionId: r.id }}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {r.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-5 py-3 font-medium">{r.product_name ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{r.inspector_name}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {r.organization_name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {new Date(r.inspection_date).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{r.location_label ?? "—"}</td>
                    <td className="px-5 py-3 tabular-nums">{r.compliance_score ?? "—"}</td>
                    <td className="px-5 py-3 tabular-nums">{r.violation_count}</td>
                    <td className="px-5 py-3 capitalize">{r.risk}</td>
                    <td className="px-5 py-3">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-5 py-3 text-xs capitalize text-muted-foreground">
                      {(r.workflow_status ?? "—").replace(/_/g, " ")}
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

function Pick({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Record<string, string>;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(options).map(([k, label]) => (
          <SelectItem key={k} value={k}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
