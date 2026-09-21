import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { adminListRules, adminUpsertRule } from "@/lib/admin.functions";
import { PageHeader, Panel, EmptyRow, StatusPill } from "@/components/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/rules")({
  head: () => ({
    meta: [
      { title: "Legal Metrology rules — Nirikshan AI admin" },
      {
        name: "description",
        content: "Configure the Legal Metrology rule engine used to evaluate every inspection.",
      },
      { property: "og:title", content: "Legal Metrology rules — Nirikshan AI admin" },
      {
        property: "og:description",
        content: "Add, edit and enable the compliance rules applied platform-wide.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RulesPage,
});

type Rule = {
  id: string;
  rule_code: string;
  rule_name: string;
  description: string | null;
  applicable_package_type: string;
  declaration_key: string | null;
  severity: string;
  version: number;
  effective_date: string;
  status: string;
};

const SEVERITIES = ["low", "medium", "high", "critical"] as const;
const STATUSES = ["active", "inactive", "draft", "superseded", "retired"] as const;

function RulesPage() {
  const qc = useQueryClient();
  const list = useServerFn(adminListRules);
  const upsert = useServerFn(adminUpsertRule);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["admin-rules"], queryFn: () => list() });

  const save = useMutation({
    mutationFn: (input: Record<string, unknown>) => upsert({ data: input } as never),
    onSuccess: () => {
      toast.success("Rule saved");
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-rules"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the rule"),
  });

  const rules = (data ?? []) as Rule[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Legal Metrology rules"
        description="The rule engine behind every compliance decision, per the Packaged Commodities Rules, 2011."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> New rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add rule</DialogTitle>
              </DialogHeader>
              <RuleForm busy={save.isPending} onSubmit={(v) => save.mutate(v)} />
            </DialogContent>
          </Dialog>
        }
      />

      <Panel title={`Rules (${rules.length})`}>
        {isLoading ? (
          <EmptyRow label="Loading rules…" />
        ) : rules.length === 0 ? (
          <EmptyRow label="No rules configured." />
        ) : (
          <ul className="divide-y divide-border">
            {rules.map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                      {rule.rule_code}
                    </span>
                    <StatusPill status={rule.severity} />
                    <span className="text-xs text-muted-foreground">v{rule.version}</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {rule.applicable_package_type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-2 font-medium">{rule.rule_name}</p>
                  {rule.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{rule.description}</p>
                  ) : null}
                  {rule.declaration_key ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Declaration: {rule.declaration_key.replace(/_/g, " ")}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs capitalize text-muted-foreground">{rule.status}</span>
                  <Switch
                    checked={rule.status === "active"}
                    aria-label={`Toggle ${rule.rule_code}`}
                    disabled={save.isPending}
                    onCheckedChange={(v) =>
                      save.mutate({
                        id: rule.id,
                        ruleCode: rule.rule_code,
                        ruleName: rule.rule_name,
                        description: rule.description,
                        applicablePackageType: rule.applicable_package_type,
                        declarationKey: rule.declaration_key,
                        severity: rule.severity as (typeof SEVERITIES)[number],
                        status: v ? "active" : "inactive",
                      })
                    }
                  />
                  <Button size="sm" variant="outline" onClick={() => setEditing(rule)}>
                    Edit
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Dialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {editing?.rule_code}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <RuleForm
              busy={save.isPending}
              initial={editing}
              onSubmit={(v) => save.mutate({ ...v, id: editing.id })}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RuleForm({
  busy,
  initial,
  onSubmit,
}: {
  busy: boolean;
  initial?: Rule;
  onSubmit: (v: {
    ruleCode: string;
    ruleName: string;
    description: string | null;
    applicablePackageType: string;
    declarationKey: string | null;
    severity: (typeof SEVERITIES)[number];
    status: (typeof STATUSES)[number];
    effectiveDate?: string;
  }) => void;
}) {
  const [ruleCode, setRuleCode] = useState(initial?.rule_code ?? "");
  const [ruleName, setRuleName] = useState(initial?.rule_name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [packageType, setPackageType] = useState(initial?.applicable_package_type ?? "all");
  const [declarationKey, setDeclarationKey] = useState(initial?.declaration_key ?? "");
  const [severity, setSeverity] = useState<string>(initial?.severity ?? "medium");
  const [status, setStatus] = useState<string>(initial?.status ?? "active");
  const [effectiveDate, setEffectiveDate] = useState(initial?.effective_date ?? "");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          ruleCode,
          ruleName,
          description: description || null,
          applicablePackageType: packageType,
          declarationKey: declarationKey || null,
          severity: severity as (typeof SEVERITIES)[number],
          status: status as (typeof STATUSES)[number],
          ...(effectiveDate ? { effectiveDate } : {}),
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="r-code">Rule code</Label>
          <Input
            id="r-code"
            value={ruleCode}
            required
            onChange={(e) => setRuleCode(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="r-date">Effective date</Label>
          <Input
            id="r-date"
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="r-name">Rule name</Label>
        <Input
          id="r-name"
          value={ruleName}
          required
          onChange={(e) => setRuleName(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="r-desc">Description</Label>
        <Textarea
          id="r-desc"
          value={description}
          rows={3}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="r-pkg">Applicable package type</Label>
          <Input
            id="r-pkg"
            value={packageType}
            required
            onChange={(e) => setPackageType(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="r-decl">Declaration key</Label>
          <Input
            id="r-decl"
            value={declarationKey}
            onChange={(e) => setDeclarationKey(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Severity</Label>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEVERITIES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save rule"}
        </Button>
      </DialogFooter>
    </form>
  );
}
