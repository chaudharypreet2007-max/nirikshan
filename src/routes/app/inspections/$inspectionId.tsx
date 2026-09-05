import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, MapPin, CalendarClock, Package, FileDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ScoreDial, StatusChip, SeverityChip, DECLARATION_LABELS, type ComplianceStatus } from "@/components/compliance";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/inspections/$inspectionId")({
  head: () => ({
    meta: [
      { title: "Inspection report — Nirikshan AI" },
      { name: "description", content: "Declaration-by-declaration compliance report with evidence and confidence scores." },
      { property: "og:title", content: "Inspection report — Nirikshan AI" },
      { property: "og:description", content: "Detailed Legal Metrology verdict, violations and corrective actions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InspectionDetail,
});

type Declaration = {
  id: string;
  declaration_type: string;
  raw_text: string | null;
  normalized_value: string | null;
  validation_status: string;
  confidence_score: number | null;
  notes: string | null;
};

type Violation = {
  id: string;
  rule_code: string | null;
  violation_type: string;
  description: string | null;
  evidence: string | null;
  severity: "low" | "medium" | "high" | "critical";
  recommendation: string | null;
};

function InspectionDetail() {
  const { inspectionId } = Route.useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["inspection", inspectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspections")
        .select(
          "id, compliance_score, status, inspection_date, location_label, latitude, longitude, image_path, summary, inspection_type, image_quality_score, ai_raw, products(product_name, brand, product_category, package_type), extracted_declarations(id, declaration_type, raw_text, normalized_value, validation_status, confidence_score, notes), violations(id, rule_code, violation_type, description, evidence, severity, recommendation)",
        )
        .eq("id", inspectionId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });


  const imagePaths: string[] = (() => {
    const raw = data?.ai_raw as { image_paths?: unknown } | null | undefined;
    const paths = Array.isArray(raw?.image_paths) ? (raw!.image_paths as string[]) : [];
    if (paths.length) return paths;
    return data?.image_path ? [data.image_path as string] : [];
  })();

  const { data: imageUrls } = useQuery({
    queryKey: ["inspection-images", imagePaths],
    enabled: imagePaths.length > 0,
    queryFn: async () => {
      const urls = await Promise.all(
        imagePaths.map(async (path) => {
          const { data: signed } = await supabase.storage
            .from("label-images")
            .createSignedUrl(path, 3600);
          return signed?.signedUrl ?? null;
        }),
      );
      return urls.filter((u): u is string => !!u);
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading report…</p>;
  if (error || !data)
    return (
      <div className="surface-panel p-8 text-center">
        <p className="text-sm text-muted-foreground">This inspection could not be found or you do not have access.</p>
        <Button asChild className="mt-4">
          <Link to="/app/inspections">Back to inspections</Link>
        </Button>
      </div>
    );

  const declarations = (data.extracted_declarations ?? []) as unknown as Declaration[];
  const violations = (data.violations ?? []) as unknown as Violation[];
  const product = data.products as unknown as
    | { product_name: string; brand: string | null; product_category: string | null; package_type: string | null }
    | null;

  const [downloading, setDownloading] = useState(false);

  const exportPdf = async () => {
    setDownloading(true);
    try {
      const { buildInspectionPdf } = await import("@/lib/inspection-pdf");
      const location =
        data.location_label ??
        (data.latitude && data.longitude
          ? `${Number(data.latitude).toFixed(4)}, ${Number(data.longitude).toFixed(4)}`
          : "Location not recorded");
      const doc = buildInspectionPdf({
        productName: product?.product_name ?? "Unidentified product",
        brand: product?.brand ?? null,
        packageType: product?.package_type ?? null,
        category: product?.product_category ?? null,
        score: data.compliance_score ?? 0,
        status: data.status,
        inspectionDate: new Date(data.inspection_date).toLocaleString(),
        location,
        inspectionType: data.inspection_type,
        summary: data.summary,
        declarations,
        violations,
      });
      const slug = (product?.product_name ?? "inspection").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      doc.save(`nirikshan-report-${slug || inspectionId}.pdf`);
    } finally {
      setDownloading(false);
    }
  };



  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/app/inspections">
          <ArrowLeft className="size-4" /> Inspections
        </Link>
      </Button>

      <header className="surface-panel flex flex-wrap items-center gap-6 p-6">
        <ScoreDial score={data.compliance_score ?? 0} status={data.status as ComplianceStatus} />
        <div className="min-w-0 flex-1">
          <StatusChip status={data.status as ComplianceStatus} />
          <h1 className="mt-3 font-display text-2xl font-bold">{product?.product_name ?? "Unidentified product"}</h1>
          <p className="text-sm text-muted-foreground">{product?.brand ?? "Brand not declared"}</p>
          <dl className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4" aria-hidden="true" />
              {new Date(data.inspection_date).toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="size-4" aria-hidden="true" />
              {data.location_label ??
                (data.latitude && data.longitude
                  ? `${Number(data.latitude).toFixed(4)}, ${Number(data.longitude).toFixed(4)}`
                  : "Location not recorded")}
            </div>
            <div className="flex items-center gap-2">
              <Package className="size-4" aria-hidden="true" />
              {product?.package_type ?? "Package type not set"}
              {product?.product_category ? ` · ${product.product_category}` : ""}
            </div>

          </dl>
        </div>
      </header>

      {data.summary ? (
        <section className="surface-panel p-5">
          <h2 className="font-display text-base font-semibold">Assessment summary</h2>
          <p className="mt-2 text-sm text-muted-foreground">{data.summary}</p>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="surface-panel overflow-hidden">
            <h2 className="border-b border-border px-5 py-4 font-display text-base font-semibold">
              Mandatory declarations
            </h2>
            <ul className="divide-y divide-border">
              {declarations.map((d) => (
                <li key={d.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{DECLARATION_LABELS[d.declaration_type] ?? d.declaration_type}</p>
                    <PresenceChip presence={d.validation_status} />
                  </div>
                  {d.normalized_value || d.raw_text ? (
                    <p className="mt-1 text-sm text-muted-foreground">{d.normalized_value || d.raw_text}</p>
                  ) : d.validation_status === "missing" ? (
                    <p className="mt-1 text-sm text-muted-foreground">Not detected on the label</p>
                  ) : null}

                  {d.normalized_value && d.raw_text && d.normalized_value !== d.raw_text ? (
                    <p className="mt-1 text-xs text-muted-foreground">On label: “{d.raw_text}”</p>
                  ) : null}
                  {d.notes ? <p className="mt-1 text-xs text-muted-foreground">{d.notes}</p> : null}
                  {d.confidence_score != null ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Confidence {Math.round(Number(d.confidence_score) * 100)}%
                    </p>
                  ) : null}
                </li>
              ))}

              {declarations.length === 0 ? (
                <li className="px-5 py-8 text-sm text-muted-foreground">No declarations were extracted.</li>
              ) : null}
            </ul>
          </section>

          <section className="surface-panel overflow-hidden">
            <h2 className="border-b border-border px-5 py-4 font-display text-base font-semibold">
              Violations ({violations.length})
            </h2>
            <ul className="divide-y divide-border">
              {violations.map((v) => (
                <li key={v.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityChip severity={v.severity} />
                    {v.rule_code ? (
                      <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                        {v.rule_code}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 font-medium">{v.violation_type}</p>
                  {v.description ? <p className="mt-1 text-sm text-muted-foreground">{v.description}</p> : null}
                  {v.evidence ? (
                    <p className="mt-1 text-xs text-muted-foreground">Evidence: {v.evidence}</p>
                  ) : null}

                  {v.recommendation ? (
                    <p className="mt-2 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
                      Corrective action: {v.recommendation}
                    </p>
                  ) : null}
                </li>
              ))}
              {violations.length === 0 ? (
                <li className="px-5 py-8 text-sm text-muted-foreground">
                  No violations were detected against the active rule set.
                </li>
              ) : null}
            </ul>
          </section>
        </div>

        <aside className="surface-panel overflow-hidden">
          <h2 className="border-b border-border px-5 py-4 font-display text-base font-semibold">
            Evidence images {imageUrls?.length ? `(${imageUrls.length})` : ""}
          </h2>
          {imageUrls?.length ? (
            <ul className="divide-y divide-border">
              {imageUrls.map((url, i) => (
                <li key={url} className="relative">
                  <span className="absolute left-2 top-2 rounded-md bg-background/80 px-2 py-0.5 text-xs font-semibold text-foreground">
                    {i + 1}
                  </span>
                  <img src={url} alt={`Scanned package label ${i + 1}`} className="w-full object-contain" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-sm text-muted-foreground">Image unavailable.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function PresenceChip({ presence }: { presence: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    present: { label: "Present", cls: "bg-compliant-soft text-compliant" },
    unclear: { label: "Unclear", cls: "bg-review-soft text-review" },
    invalid: { label: "Invalid format", cls: "bg-review-soft text-review" },
    missing: { label: "Missing", cls: "bg-violation-soft text-violation" },
  };
  const item = map[presence] ?? { label: presence, cls: "bg-muted text-muted-foreground" };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.cls}`}>{item.label}</span>;
}
