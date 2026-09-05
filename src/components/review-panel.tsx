import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ShieldQuestion, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const REASONS = [
  "Low AI confidence",
  "Possible MRP issue",
  "Possible sticker/tampering",
  "Font-size uncertainty",
  "Data mismatch",
  "Multiple MRP detected",
  "Other",
];

const WORKFLOW_LABEL: Record<string, string> = {
  submitted: "Submitted",
  submitted_for_review: "Submitted for review",
  under_supervisor_review: "Under supervisor review",
  more_evidence_required: "More evidence required",
  approved: "Approved",
  rejected: "Rejected",
  escalated: "Escalated",
  closed: "Closed",
};

export function ReviewPanel({
  inspectionId,
  isOwner,
  workflowStatus,
  imagePaths,
}: {
  inspectionId: string;
  isOwner: boolean;
  workflowStatus: string | null;
  imagePaths: string[];
}) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [reason, setReason] = useState(REASONS[0]!);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: reviews } = useQuery({
    queryKey: ["inspection-reviews", inspectionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("supervisor_reviews")
        .select("id, reason, status, decision, reviewer_notes, submitted_at")
        .eq("inspection_id", inspectionId)
        .order("submitted_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: requests } = useQuery({
    queryKey: ["inspection-evidence-requests", inspectionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("evidence_requests")
        .select("id, request_description, requested_items, status, created_at, assigned_to")
        .eq("inspection_id", inspectionId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const openRequest = (requests ?? []).find((r) => r.status === "open" && r.assigned_to === profile?.id);
  const activeReview = (reviews ?? [])[0];

  const submitReview = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("supervisor_reviews").insert({
        inspection_id: inspectionId,
        submitted_by: profile!.id,
        reason,
        notes: notes || null,
        status: "pending",
      });
      if (error) throw new Error(error.message);
      toast.success("Submitted for supervisor review — only this inspection was shared.");
      setNotes("");
      await qc.invalidateQueries({ queryKey: ["inspection-reviews", inspectionId] });
      await qc.invalidateQueries({ queryKey: ["inspection", inspectionId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit for review.");
    } finally {
      setBusy(false);
    }
  };

  const uploadEvidence = async (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (!picked.length || !openRequest) return;
    setUploading(true);
    try {
      const paths = [...imagePaths];
      for (const file of picked) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${profile!.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("label-images").upload(path, file, {
          contentType: file.type || "image/jpeg",
        });
        if (error) throw new Error(error.message);
        paths.push(path);
      }

      const { data: current } = await supabase.from("inspections").select("ai_raw").eq("id", inspectionId).maybeSingle();
      const raw = (current?.ai_raw ?? {}) as Record<string, unknown>;
      const { error: upErr } = await supabase
        .from("inspections")
        .update({ ai_raw: { ...raw, image_paths: paths } })
        .eq("id", inspectionId);
      if (upErr) throw new Error(upErr.message);

      const { error: reqErr } = await supabase
        .from("evidence_requests")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", openRequest.id);
      if (reqErr) throw new Error(reqErr.message);

      toast.success("Additional evidence sent to your supervisor.");
      await qc.invalidateQueries({ queryKey: ["inspection", inspectionId] });
      await qc.invalidateQueries({ queryKey: ["inspection-evidence-requests", inspectionId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="surface-panel space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldQuestion className="size-4 text-review" />
        <h2 className="font-display text-base font-semibold">Supervisor review</h2>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          {WORKFLOW_LABEL[workflowStatus ?? "submitted"] ?? workflowStatus}
        </span>
      </div>

      {activeReview ? (
        <div className="rounded-lg bg-muted px-4 py-3 text-sm">
          <p className="font-medium">
            {activeReview.reason} · {activeReview.status.replace(/_/g, " ")}
          </p>
          {activeReview.reviewer_notes ? (
            <p className="mt-1 text-muted-foreground">Supervisor: {activeReview.reviewer_notes}</p>
          ) : null}
          <Link
            to="/app/reviews/$reviewId"
            params={{ reviewId: activeReview.id }}
            className="mt-2 inline-block text-xs font-semibold text-primary underline"
          >
            Open review record
          </Link>
        </div>
      ) : null}

      {openRequest ? (
        <div className="rounded-lg border border-review/40 bg-review-soft px-4 py-3 text-sm">
          <p className="font-semibold text-review">Your supervisor requested additional evidence</p>
          {openRequest.request_description ? <p className="mt-1">{openRequest.request_description}</p> : null}
          <ul className="mt-2 list-disc pl-5 text-xs">
            {((openRequest.requested_items ?? []) as string[]).map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <Button className="mt-3 h-10" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Upload requested images
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void uploadEvidence(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      ) : null}

      {isOwner && (!activeReview || ["approved", "rejected", "closed"].includes(activeReview.status)) ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Request help from a senior officer. Only this inspection is shared — never your dashboard or history.
          </p>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <RadioGroup value={reason} onValueChange={setReason} className="grid gap-2 sm:grid-cols-2">
              {REASONS.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value={r} id={`reason-${r}`} />
                  {r}
                </label>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="review-notes">Additional notes</Label>
            <Textarea id="review-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button className="h-11 w-full" disabled={busy} onClick={submitReview}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null} Request supervisor review
          </Button>
        </div>
      ) : null}
    </section>
  );
}
