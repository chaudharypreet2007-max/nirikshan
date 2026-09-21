import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/app/reviews/")({
  head: () => ({
    meta: [
      { title: "Supervisor review queue — Nirikshan AI" },
      {
        name: "description",
        content: "Inspections submitted by field officers awaiting supervisor decision.",
      },
      { property: "og:title", content: "Supervisor review queue — Nirikshan AI" },
      {
        property: "og:description",
        content: "Approve, reject, escalate or request more evidence on submitted inspections.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReviewQueue,
});

const STATE_LABEL: Record<string, string> = {
  pending: "Review required",
  under_review: "Under review",
  more_evidence_required: "Awaiting evidence",
  approved: "Approved",
  rejected: "Rejected",
  escalated: "Escalated",
  closed: "Closed",
};

function ReviewQueue() {
  const { profile } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["supervisor-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supervisor_reviews")
        .select(
          "id, inspection_id, submitted_by, reason, notes, status, submitted_at, inspections(compliance_score, barcode, products(product_name)), profiles:submitted_by(full_name)",
        )
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = (data ?? []) as unknown as {
    id: string;
    inspection_id: string;
    submitted_by: string;
    reason: string;
    status: string;
    submitted_at: string;
    inspections: {
      compliance_score: number | null;
      barcode: string | null;
      products: { product_name: string } | null;
    } | null;
    profiles: { full_name: string | null } | null;
  }[];

  const mine = rows.filter((r) => r.submitted_by === profile?.id);
  const incoming = rows.filter((r) => r.submitted_by !== profile?.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Supervisor review</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Only the specific inspections submitted for review are shared — never an officer&apos;s
          full history.
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading review queue…</p>
      ) : (
        <>
          <Section
            title={`Review queue (${incoming.length})`}
            rows={incoming}
            empty="No inspections are awaiting your decision."
          />
          <Section
            title={`My review requests (${mine.length})`}
            rows={mine}
            empty="You have not submitted any inspection for review."
          />
        </>
      )}
    </div>
  );
}

function Section({
  title,
  rows,
  empty,
}: {
  title: string;
  empty: string;
  rows: {
    id: string;
    inspection_id: string;
    reason: string;
    status: string;
    submitted_at: string;
    inspections: {
      compliance_score: number | null;
      barcode: string | null;
      products: { product_name: string } | null;
    } | null;
    profiles: { full_name: string | null } | null;
  }[];
}) {
  return (
    <section className="surface-panel overflow-hidden">
      <h2 className="flex items-center gap-2 border-b border-border px-5 py-4 font-display text-base font-semibold">
        <ClipboardCheck className="size-4" /> {title}
      </h2>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                to="/app/reviews/$reviewId"
                params={{ reviewId: r.id }}
                className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {r.inspections?.products?.product_name ?? "Unidentified product"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Reason: {r.reason}
                    {r.profiles?.full_name ? ` · Officer: ${r.profiles.full_name}` : ""} ·{" "}
                    {new Date(r.submitted_at).toLocaleString()}
                    {r.inspections?.barcode ? ` · ${r.inspections.barcode}` : ""}
                  </p>
                </div>
                <span className="font-display text-lg font-semibold">
                  {r.inspections?.compliance_score ?? "—"}
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  {STATE_LABEL[r.status] ?? r.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
