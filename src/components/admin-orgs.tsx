import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  adminListOrganizations,
  adminUpsertOrganization,
  adminListUsers,
  adminUpdateUser,
} from "@/lib/admin.functions";
import { Panel, EmptyRow, StatusPill } from "@/components/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Scope = "government" | "business";
type OrgType = "government" | "private" | "manufacturer" | "retailer" | "inspection_agency";

const GOV_TYPES: OrgType[] = ["government"];
const BIZ_TYPES: OrgType[] = ["manufacturer", "retailer", "inspection_agency", "private"];
const STATUSES = [
  "active",
  "pending_verification",
  "verified",
  "suspended",
  "deactivated",
] as const;

export function OrganisationManager({ scope }: { scope: Scope }) {
  const qc = useQueryClient();
  const listOrgs = useServerFn(adminListOrganizations);
  const upsert = useServerFn(adminUpsertOrganization);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const { data: orgs, isLoading } = useQuery({
    queryKey: ["admin-orgs", scope, search],
    queryFn: () => listOrgs({ data: { scope, search } }),
  });

  const save = useMutation({
    mutationFn: (input: Record<string, unknown>) => upsert({ data: input } as never),
    onSuccess: () => {
      toast.success("Organisation saved");
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-orgs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the organisation"),
  });

  const types = scope === "government" ? GOV_TYPES : BIZ_TYPES;
  const current = (orgs ?? []).find((o) => o.id === editing) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          className="max-w-sm"
          placeholder="Search organisations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> New organisation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register organisation</DialogTitle>
            </DialogHeader>
            <OrgForm types={types} busy={save.isPending} onSubmit={(v) => save.mutate(v)} />
          </DialogContent>
        </Dialog>
      </div>

      <Panel title={`Organisations (${orgs?.length ?? 0})`}>
        {isLoading ? (
          <EmptyRow label="Loading organisations…" />
        ) : (orgs ?? []).length === 0 ? (
          <EmptyRow label="No organisations registered yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-2 font-semibold">Organisation</th>
                  <th className="px-5 py-2 font-semibold">Type</th>
                  <th className="px-5 py-2 font-semibold">Jurisdiction</th>
                  <th className="px-5 py-2 font-semibold">Registration</th>
                  <th className="px-5 py-2 font-semibold">Users</th>
                  <th className="px-5 py-2 font-semibold">Inspections</th>
                  <th className="px-5 py-2 font-semibold">Status</th>
                  <th className="px-5 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(orgs ?? []).map((o) => (
                  <tr key={o.id}>
                    <td className="px-5 py-3 font-medium">{o.name}</td>
                    <td className="px-5 py-3 capitalize text-muted-foreground">
                      {o.organization_type.replace(/_/g, " ")}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{o.jurisdiction ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {o.registration_number ?? "—"}
                    </td>
                    <td className="px-5 py-3 tabular-nums">{o.user_count}</td>
                    <td className="px-5 py-3 tabular-nums">{o.inspection_count}</td>
                    <td className="px-5 py-3">
                      <StatusPill status={o.status} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditing(o.id)}>
                          Edit
                        </Button>
                        {scope === "business" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={save.isPending}
                            onClick={() =>
                              save.mutate({
                                id: o.id,
                                name: o.name,
                                organizationType: o.organization_type as OrgType,
                                jurisdiction: o.jurisdiction,
                                registrationNumber: o.registration_number,
                                status: "verified",
                              })
                            }
                          >
                            Verify
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={save.isPending}
                          onClick={() =>
                            save.mutate({
                              id: o.id,
                              name: o.name,
                              organizationType: o.organization_type as OrgType,
                              jurisdiction: o.jurisdiction,
                              registrationNumber: o.registration_number,
                              status: o.status === "suspended" ? "active" : "suspended",
                            })
                          }
                        >
                          {o.status === "suspended" ? "Reactivate" : "Suspend"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Dialog open={Boolean(current)} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {current?.name}</DialogTitle>
          </DialogHeader>
          {current ? (
            <OrgForm
              types={types}
              busy={save.isPending}
              initial={{
                name: current.name,
                organizationType: current.organization_type as OrgType,
                jurisdiction: current.jurisdiction ?? "",
                registrationNumber: current.registration_number ?? "",
                status: current.status,
              }}
              onSubmit={(v) => save.mutate({ ...v, id: current.id })}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrgForm({
  types,
  busy,
  initial,
  onSubmit,
}: {
  types: OrgType[];
  busy: boolean;
  initial?: {
    name: string;
    organizationType: OrgType;
    jurisdiction: string;
    registrationNumber: string;
    status: string;
  };
  onSubmit: (v: {
    name: string;
    organizationType: OrgType;
    jurisdiction: string | null;
    registrationNumber: string | null;
    status: (typeof STATUSES)[number];
  }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [organizationType, setOrganizationType] = useState<OrgType>(
    initial?.organizationType ?? types[0]!,
  );
  const [jurisdiction, setJurisdiction] = useState(initial?.jurisdiction ?? "");
  const [registrationNumber, setRegistrationNumber] = useState(initial?.registrationNumber ?? "");
  const [status, setStatus] = useState<string>(initial?.status ?? "active");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name,
          organizationType,
          jurisdiction: jurisdiction || null,
          registrationNumber: registrationNumber || null,
          status: status as (typeof STATUSES)[number],
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="org-name">Name</Label>
        <Input id="org-name" value={name} required onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select value={organizationType} onValueChange={(v) => setOrganizationType(v as OrgType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">
                {t === "private" ? "Private company" : t.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="org-jur">Jurisdiction</Label>
        <Input
          id="org-jur"
          value={jurisdiction}
          onChange={(e) => setJurisdiction(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="org-reg">Registration number</Label>
        <Input
          id="org-reg"
          value={registrationNumber}
          onChange={(e) => setRegistrationNumber(e.target.value)}
        />
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
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save organisation"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function PortalPeople({ portal }: { portal: "government" | "private" }) {
  const qc = useQueryClient();
  const listUsers = useServerFn(adminListUsers);
  const listOrgs = useServerFn(adminListOrganizations);
  const updateUser = useServerFn(adminUpdateUser);
  const [search, setSearch] = useState("");

  const { data: users } = useQuery({
    queryKey: ["admin-users", portal, search],
    queryFn: () => listUsers({ data: { portal, search } }),
  });
  const { data: orgs } = useQuery({
    queryKey: ["admin-orgs", "all"],
    queryFn: () => listOrgs({ data: { scope: "all" as const } }),
  });

  const update = useMutation({
    mutationFn: (input: Record<string, unknown>) => updateUser({ data: input } as never),
    onSuccess: () => {
      toast.success("Account updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update the account"),
  });

  const roleOptions =
    portal === "government" ? ["gov_admin", "inspector", "super_admin"] : ["org_admin", "org_user"];

  return (
    <div className="space-y-4">
      <Input
        className="max-w-sm"
        placeholder={portal === "government" ? "Search officers…" : "Search business users…"}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Panel title={portal === "government" ? "Officers and administrators" : "Business users"}>
        {(users ?? []).length === 0 ? (
          <EmptyRow label="No accounts on this portal yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-2 font-semibold">User</th>
                  <th className="px-5 py-2 font-semibold">Role</th>
                  <th className="px-5 py-2 font-semibold">
                    {portal === "government" ? "Jurisdiction" : "Organisation"}
                  </th>
                  <th className="px-5 py-2 font-semibold">Status</th>
                  <th className="px-5 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(users ?? []).map((u) => (
                  <tr key={u.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium">{u.full_name ?? "Unnamed"}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <Select
                        value={u.roles[0] ?? ""}
                        onValueChange={(v) => update.mutate({ userId: u.id, role: v as never })}
                      >
                        <SelectTrigger className="h-9 w-44">
                          <SelectValue placeholder="Assign role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map((r) => (
                            <SelectItem key={r} value={r} className="capitalize">
                              {r.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-5 py-3">
                      {portal === "government" ? (
                        <span className="text-muted-foreground">{u.jurisdiction ?? "—"}</span>
                      ) : (
                        <Select
                          value={u.organization_id ?? "none"}
                          onValueChange={(v) =>
                            update.mutate({ userId: u.id, organizationId: v === "none" ? null : v })
                          }
                        >
                          <SelectTrigger className="h-9 w-52">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No organisation</SelectItem>
                            {(orgs ?? []).map((o) => (
                              <SelectItem key={o.id} value={o.id}>
                                {o.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill status={u.account_status} />
                    </td>
                    <td className="px-5 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={update.isPending}
                        onClick={() =>
                          update.mutate({
                            userId: u.id,
                            accountStatus: u.account_status === "active" ? "deactivated" : "active",
                          })
                        }
                      >
                        {u.account_status === "active" ? "Deactivate" : "Activate"}
                      </Button>
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
