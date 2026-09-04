import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ScanLine, ClipboardList, ShieldAlert, Activity, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StatusChip, type ComplianceStatus } from "@/components/compliance";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({
    meta: [
      { title: "Compliance dashboard — Nirikshan AI" },
      { name: "description", content: "Scan volume, compliance rate, violations and pending reviews at a glance." },
      { property: "og:title", content: "Compliance dashboard — Nirikshan AI" },
      { property: "og:description", content: "Live packaged commodity compliance metrics for your portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

type Row = {
  id: string;
  compliance_score: number | null;
  status: ComplianceStatus;
  inspection_date: string;
  location_label: string | null;
  products: { product_name: string; brand: string | null } | null;
};

function Dashboard() {
  const { isGovernment, profile } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-inspections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspections")
        .select("id, compliance_score, status, inspection_date, location_label, products(product_name, brand)")
        .order("inspection_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const rows = data ?? [];
  const total = rows.length;
  const compliant = rows.filter((r) => r.status === "compliant").length;
  const nonCompliant = rows.filter((r) => r.status === "non_compliant").length;
  const review = rows.filter((r) => r.status === "needs_review").length;
  const rate = total ? Math.round((compliant / total) * 100) : 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            {isGovernment ? "Enforcement overview" : "Compliance overview"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile?.full_name ? `Welcome back, ${profile.full_name}. ` : ""}
            {isGovernment
              ? "Field inspections and violations across your jurisdiction."
              : "Pre-dispatch verification status for your organisation's packaging."}
          </p>
        </div>
        <Button asChild className="h-11">
          <Link to="/app/scan">
            <ScanLine className="size-4" /> New scan
          </Link>
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total scans" value={total} icon={ClipboardList} />
        <Stat label="Compliance rate" value={`${rate}%`} icon={Activity} />
        <Stat label={isGovernment ? "Non-compliant" : "Blocking issues"} value={nonCompliant} icon={ShieldAlert} tone="violation" />
        <Stat label="Pending review" value={review} icon={ShieldAlert} tone="review" />
      </section>

      <section className="surface-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-base font-semibold">Recent inspections</h2>
          <Link to="/app/inspections" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
            View all <ArrowRight className="size-4" />
          </Link>
        </div>

        {isLoading ? (
          <p className="px-5 py-8 text-sm text-muted-foreground">Loading inspections…</p>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-muted-foreground">No inspections yet. Scan your first package to get started.</p>
            <Button asChild className="mt-4">
              <Link to="/app/scan">Scan a package</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.slice(0, 6).map((r) => (
              <li key={r.id}>
                <Link
                  to="/app/inspections/$inspectionId"
                  params={{ inspectionId: r.id }}
                  className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.products?.product_name ?? "Unidentified product"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {new Date(r.inspection_date).toLocaleString()} {r.location_label ? `· ${r.location_label}` : ""}
                    </p>
                  </div>
                  <span className="font-display text-lg font-semibold">{r.compliance_score ?? "—"}</span>
                  <StatusChip status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: typeof Activity;
  tone?: "default" | "violation" | "review";
}) {
  const toneClass =
    tone === "violation"
      ? "bg-violation-soft text-violation"
      : tone === "review"
        ? "bg-review-soft text-review"
        : "bg-secondary text-secondary-foreground";
  return (
    <div className="surface-panel p-5">
      <span className={`flex size-9 items-center justify-center rounded-lg ${toneClass}`}>
        <Icon className="size-4.5" aria-hidden="true" />
      </span>
      <p className="mt-4 font-display text-3xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
