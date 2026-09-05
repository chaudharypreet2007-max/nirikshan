import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StatusChip, SeverityChip, DECLARATION_LABELS, type ComplianceStatus } from "@/components/compliance";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/app/reviews/$reviewId")({
  head: () => ({
    meta: [
      { title: "Review inspection — Nirikshan AI" },
      { name: "description", content: "Supervisor review screen with evidence, declarations, violations and decision actions." },
      { property: "og:title", content: "Review inspection — Nirikshan AI" },
      { property: "og:description", content: "Approve, reject, escalate or request more evidence for a submitted inspection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReviewScreen,
});

const EVIDENCE_ITEMS = [
  "Back side of package",
  "MRP area",
  "Manufacturer declaration",
  "Barcode area",
  "Better image of font",
];

function ReviewScreen() {
  const { reviewId } = Route.useParams();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["review", reviewId],
    queryFn: async () => {
      const { data: review, error: rErr } = await supabase
        .from("supervisor_reviews")
        .select("*, profiles:submitted_by(full_name, official_id, jurisdiction)")
        .eq("id", reviewId)
        .maybeSingle();
      if (rErr) throw rErr;
      if (!review) return null;

      const { data: inspection } = await supabase
        .from("inspections")
        .select(
          "id, compliance_score, status, workflow_status, inspection_date, location_label, latitude, longitude, barcode, barcode_source, package_context, product_match_score, summary, ai_raw, image_path, products(product_name, brand, manufacturer, product_category, package_type), extracted_declarations(id, declaration_type, raw_text, normalized_value, validation_status, confidence_score), violations(id, rule_code, violation_type, description, evidence, severity)",
        )
        .eq("id", review.inspection_id)
        .maybeSingle();

      return { review, inspection };
    },
  });

  const { data: images } = useQuery({
    queryKey: ["review-images", reviewId, data?.inspection?.id],
    enabled: !!data?.inspection,
    queryFn: async () => {
      const raw = data?.inspection?.ai_raw as { image_paths?: unknown } | null;
      const paths = Array.isArray(raw?.image_paths)
        ? (raw!.image_paths as string[])
        : data?.inspection?.image_path
          ? [data.inspection.image_path as string]
          : [];
      const urls = await Promise.all(
        paths.map(async (p) => (await supabase.storage.from("label-images").createSignedUrl(p, 3600)).data?.signedUrl ?? null),
      );
      return urls.filter((u): u is string => !!u);
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading review…</p>;
  if (error || !data?.review)
    return (
      <div className="surface-panel p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Access denied. This review either does not exist or you are not authorised to see it.
        </p>
        <Button asChild className="mt-4">
          <Link to="/app/reviews">Back to review queue</Link>
        </Button>
      </div>
    );

  const review = data.review as unknown as {
    id: string;
    inspection_id: string;
    submitted_by: string;
    reason: string;
    notes: string | null;
    status: string;
    decision: string | null;
    reviewer_notes: string | null;
    submitted_at: string;
    profiles: { full_name: string | null; official_id: string | null; jurisdiction: string | null } | null;
  };
  const inspection = data.inspection as unknown as
    | {
        id: string;
        compliance_score: number | null;
        status: ComplianceStatus;
        workflow_status: string;
        inspection_date: string;
        location_label: string | null;
        latitude: number | null;
        longitude: number | null;
        barcode: string | null;
        barcode_source: string | null;
        package_context: string | null;
        product_match_score: number | null;
        summary: string | null;
        products: {
          product_name: string;
          brand: string | null;
          manufacturer: string | null;
          product_category: string | null;
          package_type: string | null;
        } | null;
        extracted_declarations: {
          id: string;
          declaration_type: string;
          raw_text: string | null;
          normalized_value: string | null;
          validation_status: string;
          confidence_score: number | null;
        }[];
        violations: {
          id: string;
          rule_code: string | null;
          violation_type: string;
          description: string | null;
          evidence: string | null;
          severity: "low" | "medium" | "high" | "critical";
        }[];
      }
    | null;

  const isSubmitter = review.submitted_by === profile?.id;
  const canDecide = !isSubmitter;

  const decide = async (status: string, decision: string) => {
    setBusy(true);
    try {
      const { error: uErr } = await supabase
        .from("supervisor_reviews")
        .update({
          status,
          decision,
          reviewer_id: profile?.id ?? null,
          reviewer_notes: notes || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", review.id);
      if (uErr) throw new Error(uErr.message);

      if (status === "more_evidence_required") {
        const { error: eErr } = await supabase.from("evidence_requests").insert({
          inspection_id: review.inspection_id,
          review_id: review.id,
          requested_by: profile!.id,
          assigned_to: review.submitted_by,
          request_description: notes || null,
          requested_items: items,
        });
        if (eErr) throw new Error(eErr.message);
      }

      toast.success(`Decision recorded: ${decision}`);
      await qc.invalidateQueries({ queryKey: ["review", reviewId] });
      await qc.invalidateQueries({ queryKey: ["supervisor-reviews"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record the decision.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/app/reviews">
          <ArrowLeft className="size-4" /> Review queue
        </Link>
      </Button>

      <header className="surface-panel p-6">
        <div className="flex flex-wrap items-center gap-3">
          <ShieldAlert className="size-5 text-review" />
          <h1 className="font-display text-xl font-bold">
            {inspection?.products?.product_name ?? "Unidentified product"}
          </h1>
          {inspection ? <StatusChip status={inspection.status} /> : null}
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {review.status.replace(/_/g, " ")}
          </span>
        </div>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Compliance score" value={inspection?.compliance_score != null ? `${inspection.compliance_score}%` : "—"} />
          <Field label="Reason for review" value={review.reason} />
          <Field label="Officer" value={review.profiles?.full_name ?? "Officer"} />
          <Field label="Official ID" value={review.profiles?.official_id} />
          <Field label="Jurisdiction" value={review.profiles?.jurisdiction} />
          <Field label="Submitted" value={new Date(review.submitted_at).toLocaleString()} />
          <Field label="Barcode" value={inspection?.barcode ?? "Not detected"} />
          <Field label="Barcode source" value={inspection?.barcode_source} />
          <Field
            label="Product identity match"
            value={inspection?.product_match_score != null ? `${Math.round(Number(inspection.product_match_score))}%` : "—"}
          />
          <Field label="Package context" value={inspection?.package_context} />
          <Field
            label="Location"
            value={
              inspection?.location_label ??
              (inspection?.latitude && inspection?.longitude
                ? `${Number(inspection.latitude).toFixed(4)}, ${Number(inspection.longitude).toFixed(4)}`
                : "Not recorded")
            }
          />
          <Field label="Inspected at" value={inspection ? new Date(inspection.inspection_date).toLocaleString() : "—"} />
        </dl>
        {review.notes ? (
          <p className="mt-4 rounded-lg bg-muted px-4 py-3 text-sm">Inspector notes: {review.notes}</p>
        ) : null}
        {review.reviewer_notes ? (
          <p className="mt-2 rounded-lg bg-accent px-4 py-3 text-sm text-accent-foreground">
            Supervisor notes: {review.reviewer_notes}
          </p>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {inspection?.summary ? (
            <section className="surface-panel p-5">
              <h2 className="font-display text-base font-semibold">AI assessment</h2>
              <p className="mt-2 text-sm text-muted-foreground">{inspection.summary}</p>
            </section>
          ) : null}

          <section className="surface-panel overflow-hidden">
            <h2 className="border-b border-border px-5 py-4 font-display text-base font-semibold">Declarations</h2>
            <ul className="divide-y divide-border text-sm">
              {(inspection?.extracted_declarations ?? []).map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2 px-5 py-3">
                  <span className="flex-1 font-medium">{DECLARATION_LABELS[d.declaration_type] ?? d.declaration_type}</span>
                  <span className="text-muted-foreground">{d.normalized_value || d.raw_text || "Not detected"}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{d.validation_status}</span>
                  {d.confidence_score != null ? (
                    <span className="text-xs text-muted-foreground">{Math.round(Number(d.confidence_score) * 100)}%</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="surface-panel overflow-hidden">
            <h2 className="border-b border-border px-5 py-4 font-display text-base font-semibold">
              Violations ({inspection?.violations.length ?? 0})
            </h2>
            <ul className="divide-y divide-border">
              {(inspection?.violations ?? []).map((v) => (
                <li key={v.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityChip severity={v.severity} />
                    {v.rule_code ? (
                      <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">{v.rule_code}</span>
                    ) : null}
                  </div>
                  <p className="mt-2 font-medium">{v.violation_type}</p>
                  {v.description ? <p className="mt-1 text-sm text-muted-foreground">{v.description}</p> : null}
                  {v.evidence ? <p className="mt-1 text-xs text-muted-foreground">Evidence: {v.evidence}</p> : null}
                </li>
              ))}
              {(inspection?.violations.length ?? 0) === 0 ? (
                <li className="px-5 py-8 text-sm text-muted-foreground">No violations recorded.</li>
              ) : null}
            </ul>
          </section>

          {canDecide ? (
            <section className="surface-panel space-y-4 p-5">
              <h2 className="font-display text-base font-semibold">Decision</h2>
              <div className="space-y-1.5">
                <Label htmlFor="rnotes">Supervisor notes</Label>
                <Textarea id="rnotes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>

              <div>
                <p className="text-sm font-medium">Evidence to request (optional)</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {EVIDENCE_ITEMS.map((item) => (
                    <label key={item} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={items.includes(item)}
                        onCheckedChange={(c) =>
                          setItems((prev) => (c ? [...prev, item] : prev.filter((i) => i !== item)))
                        }
                      />
                      {item}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button disabled={busy} onClick={() => decide("approved", "approved")}>Approve</Button>
                <Button disabled={busy} variant="destructive" onClick={() => decide("rejected", "rejected")}>
                  Reject
                </Button>
                <Button disabled={busy} variant="outline" onClick={() => decide("more_evidence_required", "more_evidence_required")}>
                  Request more evidence
                </Button>
                <Button disabled={busy} variant="outline" onClick={() => decide("under_review", "sent_back_to_officer")}>
                  Send back to officer
                </Button>
                <Button disabled={busy} variant="secondary" className="sm:col-span-2" onClick={() => decide("escalated", "escalated")}>
                  Escalate to senior authority
                </Button>
              </div>
            </section>
          ) : (
            <p className="surface-panel p-5 text-sm text-muted-foreground">
              You submitted this inspection — only an authorised supervisor can record a decision.
            </p>
          )}
        </div>

        <aside className="surface-panel overflow-hidden">
          <h2 className="border-b border-border px-5 py-4 font-display text-base font-semibold">
            Evidence images {images?.length ? `(${images.length})` : ""}
          </h2>
          {images?.length ? (
            <ul className="divide-y divide-border">
              {images.map((url, i) => (
                <li key={url} className="relative">
                  <span className="absolute left-2 top-2 rounded-md bg-background/80 px-2 py-0.5 text-xs font-semibold">
                    {i + 1}
                  </span>
                  <img src={url} alt={`Submitted package evidence ${i + 1}`} className="w-full object-contain" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-sm text-muted-foreground">No evidence images available.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value ?? "—"}</dd>
    </div>
  );
}
