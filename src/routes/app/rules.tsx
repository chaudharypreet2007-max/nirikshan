import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SeverityChip } from "@/components/compliance";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/app/rules")({
  head: () => ({
    meta: [
      { title: "Rule engine — Nirikshan AI" },
      {
        name: "description",
        content:
          "Configurable Legal Metrology rules used to evaluate packaged commodity declarations.",
      },
      { property: "og:title", content: "Rule engine — Nirikshan AI" },
      {
        property: "og:description",
        content: "View and toggle the compliance rules applied to every scan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Rules,
});

type Rule = {
  id: string;
  rule_code: string;
  rule_name: string;
  description: string | null;
  declaration_key: string | null;
  severity: "low" | "medium" | "high" | "critical";
  status: string;
};

function Rules() {
  const { isGovernment, isAdmin } = useAuth();
  const qc = useQueryClient();
  const canEdit = isGovernment && isAdmin;

  const { data, isLoading } = useQuery({
    queryKey: ["compliance-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_rules")
        .select("id, rule_code, rule_name, description, declaration_key, severity, status")
        .order("rule_code");
      if (error) throw error;
      return (data ?? []) as Rule[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("compliance_rules").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compliance-rules"] });
      toast.success("Rule updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update the rule"),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Rule engine</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rules from the Legal Metrology (Packaged Commodities) Rules, 2011 applied to every scan.
          {canEdit
            ? " Administrators can enable or disable rules."
            : " Rule changes are restricted to enforcement administrators."}
        </p>
      </header>

      <section className="surface-panel overflow-hidden">
        {isLoading ? (
          <p className="px-5 py-8 text-sm text-muted-foreground">Loading rules…</p>
        ) : (
          <ul className="divide-y divide-border">
            {(data ?? []).map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                      {rule.rule_code}
                    </span>
                    <SeverityChip severity={rule.severity} />
                  </div>
                  <p className="mt-2 font-medium">{rule.rule_name}</p>
                  {rule.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{rule.description}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {rule.status === "active" ? "Active" : "Disabled"}
                  </span>
                  <Switch
                    checked={rule.status === "active"}
                    disabled={!canEdit || toggle.isPending}
                    aria-label={`Toggle ${rule.rule_code}`}
                    onCheckedChange={(v) =>
                      toggle.mutate({ id: rule.id, status: v ? "active" : "inactive" })
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
