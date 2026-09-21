import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListProducts } from "@/lib/admin.functions";
import { PageHeader, Panel, EmptyRow, StatusPill } from "@/components/admin-ui";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/products")({
  head: () => ({
    meta: [
      { title: "Product management — Nirikshan AI admin" },
      {
        name: "description",
        content: "The full Nirikshan AI product repository with inspection and risk history.",
      },
      { property: "og:title", content: "Product management — Nirikshan AI admin" },
      {
        property: "og:description",
        content: "Search, filter and review every registered packaged commodity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const listProducts = useServerFn(adminListProducts);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("recent");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", search, status],
    queryFn: () => listProducts({ data: { search, status } }),
  });

  const rows = [...(data ?? [])].sort((a, b) => {
    if (sort === "name") return (a.product_name ?? "").localeCompare(b.product_name ?? "");
    if (sort === "inspections") return b.inspection_count - a.inspection_count;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product management"
        description="Every packaged commodity known to the platform. Barcodes are used for discovery only, never for access."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          placeholder="Search product, brand, barcode…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All inspection states</SelectItem>
            <SelectItem value="not_inspected">Not inspected</SelectItem>
            <SelectItem value="inspected">Inspected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Newest first</SelectItem>
            <SelectItem value="name">Product name</SelectItem>
            <SelectItem value="inspections">Most inspected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Panel title={`Products (${rows.length})`}>
        {isLoading ? (
          <EmptyRow label="Loading products…" />
        ) : rows.length === 0 ? (
          <EmptyRow label="No products match these filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-2 font-semibold">Product</th>
                  <th className="px-5 py-2 font-semibold">Barcode</th>
                  <th className="px-5 py-2 font-semibold">Manufacturer</th>
                  <th className="px-5 py-2 font-semibold">Category</th>
                  <th className="px-5 py-2 font-semibold">Package</th>
                  <th className="px-5 py-2 font-semibold">Quantity</th>
                  <th className="px-5 py-2 font-semibold">Inspections</th>
                  <th className="px-5 py-2 font-semibold">Last result</th>
                  <th className="px-5 py-2 font-semibold">State</th>
                  <th className="px-5 py-2 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium">{p.product_name}</p>
                      <p className="text-xs text-muted-foreground">{p.brand ?? "—"}</p>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                      {p.barcode ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{p.manufacturer ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{p.product_category ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{p.package_type ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{p.net_quantity ?? "—"}</td>
                    <td className="px-5 py-3 tabular-nums">{p.inspection_count}</td>
                    <td className="px-5 py-3">
                      {p.latest_status ? (
                        <span className="flex items-center gap-2">
                          <StatusPill status={p.latest_status} />
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {p.latest_score ?? "—"}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Never inspected</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill status={p.inspection_status} />
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {p.external_source ?? "Nirikshan AI"}
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
