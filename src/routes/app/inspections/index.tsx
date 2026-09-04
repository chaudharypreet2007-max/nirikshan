import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, ScanLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatusChip, type ComplianceStatus } from "@/components/compliance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/app/inspections/")({
  head: () => ({
    meta: [
      { title: "Inspections — Nirikshan AI" },
      { name: "description", content: "Search and filter every packaged commodity compliance inspection on record." },
      { property: "og:title", content: "Inspections — Nirikshan AI" },
      { property: "og:description", content: "Full inspection history with compliance scores and verdicts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Inspections,
});

type Row = {
  id: string;
  compliance_score: number | null;
  status: ComplianceStatus;
  inspection_date: string;
  location_label: string | null;
  products: { product_name: string; brand: string | null; product_category: string | null } | null;
};

const FILTERS: { value: "all" | ComplianceStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "compliant", label: "Compliant" },
  { value: "needs_review", label: "Needs review" },
  { value: "non_compliant", label: "Non-compliant" },
];

function Inspections() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | ComplianceStatus>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["inspections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspections")
        .select(
          "id, compliance_score, status, inspection_date, location_label, products(product_name, brand, product_category)",
        )
        .order("inspection_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const rows = (data ?? []).filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (!q.trim()) return true;
    const hay = `${r.products?.product_name ?? ""} ${r.products?.brand ?? ""} ${r.location_label ?? ""}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Inspections</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every scan with its verdict, score and audit metadata.</p>
        </div>
        <Button asChild className="h-11">
          <Link to="/app/scan">
            <ScanLine className="size-4" /> New scan
          </Link>
        </Button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            className="h-11 pl-9"
            placeholder="Search product, brand or location"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search inspections"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              type="button"
              size="sm"
              variant={filter === f.value ? "default" : "outline"}
              className="h-9"
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <section className="surface-panel overflow-hidden">
        {isLoading ? (
          <p className="px-5 py-8 text-sm text-muted-foreground">Loading inspections…</p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">No inspections match this view.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  to="/app/inspections/$inspectionId"
                  params={{ inspectionId: r.id }}
                  className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.products?.product_name ?? "Unidentified product"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.products?.brand ? `${r.products.brand} · ` : ""}
                      {new Date(r.inspection_date).toLocaleString()}
                      {r.location_label ? ` · ${r.location_label}` : ""}
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
