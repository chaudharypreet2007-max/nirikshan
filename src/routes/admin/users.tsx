import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import {
  adminListUsers,
  adminCreateUser,
  adminUpdateUser,
  adminResetUserAccess,
  adminListOrganizations,
} from "@/lib/admin.functions";
import { PageHeader, Panel, EmptyRow, StatusPill } from "@/components/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "User management — Nirikshan AI admin" },
      {
        name: "description",
        content: "Create, edit, suspend and re-assign every Nirikshan AI platform account.",
      },
      { property: "og:title", content: "User management — Nirikshan AI admin" },
      {
        property: "og:description",
        content: "Accounts, roles, organisations and account status in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UsersPage,
});

const ROLES = [
  "main_admin",
  "super_admin",
  "gov_admin",
  "inspector",
  "org_admin",
  "org_user",
] as const;
type Role = (typeof ROLES)[number];
type Portal = "government" | "private" | "admin";

function UsersPage() {
  const qc = useQueryClient();
  const listUsers = useServerFn(adminListUsers);
  const listOrgs = useServerFn(adminListOrganizations);
  const createUser = useServerFn(adminCreateUser);
  const updateUser = useServerFn(adminUpdateUser);
  const resetAccess = useServerFn(adminResetUserAccess);

  const [search, setSearch] = useState("");
  const [portal, setPortal] = useState("all");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users", search, portal, role, status],
    queryFn: () => listUsers({ data: { search, portal, role, status } }),
  });
  const { data: orgs } = useQuery({
    queryKey: ["admin-orgs", "all"],
    queryFn: () => listOrgs({ data: { scope: "all" as const } }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const create = useMutation({
    mutationFn: (input: Record<string, unknown>) => createUser({ data: input } as never),
    onSuccess: () => {
      toast.success("Account created");
      setCreateOpen(false);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create the account"),
  });

  const update = useMutation({
    mutationFn: (input: Record<string, unknown>) => updateUser({ data: input } as never),
    onSuccess: () => {
      toast.success("Account updated");
      setEditing(null);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update the account"),
  });

  const reset = useMutation({
    mutationFn: (input: { userId: string; email: string }) => resetAccess({ data: input }),
    onSuccess: () => toast.success("Access reset link generated"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not reset access"),
  });

  const current = (users ?? []).find((u) => u.id === editing) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="User management"
        description="Every account on the platform, across both portals."
        action={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="size-4" /> New user
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create account</DialogTitle>
              </DialogHeader>
              <CreateForm
                orgs={orgs ?? []}
                busy={create.isPending}
                onSubmit={(v) => create.mutate(v)}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search name, email, ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Filter
          value={portal}
          onChange={setPortal}
          label="Portal"
          options={["government", "private", "admin"]}
        />
        <Filter value={role} onChange={setRole} label="Role" options={[...ROLES]} />
        <Filter
          value={status}
          onChange={setStatus}
          label="Status"
          options={["active", "suspended", "deactivated"]}
        />
      </div>

      <Panel title={`Accounts (${users?.length ?? 0})`}>
        {isLoading ? (
          <EmptyRow label="Loading accounts…" />
        ) : (users ?? []).length === 0 ? (
          <EmptyRow label="No accounts match these filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-2 font-semibold">User</th>
                  <th className="px-5 py-2 font-semibold">Portal</th>
                  <th className="px-5 py-2 font-semibold">Role</th>
                  <th className="px-5 py-2 font-semibold">Organisation</th>
                  <th className="px-5 py-2 font-semibold">Created</th>
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
                    <td className="px-5 py-3 capitalize text-muted-foreground">{u.portal_type}</td>
                    <td className="px-5 py-3 capitalize">
                      {u.roles.join(", ").replace(/_/g, " ") || "—"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {u.organization_name ?? u.jurisdiction ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill status={u.account_status} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditing(u.id)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={update.isPending}
                          onClick={() =>
                            update.mutate({
                              userId: u.id,
                              accountStatus: u.account_status === "active" ? "suspended" : "active",
                            })
                          }
                        >
                          {u.account_status === "active" ? "Suspend" : "Activate"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={reset.isPending || !u.email}
                          onClick={() => reset.mutate({ userId: u.id, email: u.email ?? "" })}
                        >
                          Reset access
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

      <Dialog open={Boolean(current)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {current?.full_name ?? current?.email}</DialogTitle>
          </DialogHeader>
          {current ? (
            <EditForm
              user={current}
              orgs={orgs ?? []}
              busy={update.isPending}
              onSubmit={(v) => update.mutate({ userId: current.id, ...v })}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Filter({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {label.toLowerCase()}s</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o} className="capitalize">
            {o.replace(/_/g, " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type Org = { id: string; name: string; organization_type: string };

function CreateForm({
  orgs,
  busy,
  onSubmit,
}: {
  orgs: Org[];
  busy: boolean;
  onSubmit: (v: {
    email: string;
    password: string;
    fullName: string;
    portalType: Portal;
    role: Role;
    organizationId?: string | null;
    jurisdiction?: string | null;
    officialId?: string | null;
    designation?: string | null;
  }) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [portalType, setPortalType] = useState<Portal>("government");
  const [role, setRole] = useState<Role>("inspector");
  const [organizationId, setOrganizationId] = useState("none");
  const [jurisdiction, setJurisdiction] = useState("");
  const [officialId, setOfficialId] = useState("");
  const [designation, setDesignation] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          email,
          password,
          fullName,
          portalType,
          role,
          organizationId: organizationId === "none" ? null : organizationId,
          jurisdiction: jurisdiction || null,
          officialId: officialId || null,
          designation: designation || null,
        });
      }}
    >
      <TextField id="c-name" label="Full name" value={fullName} onChange={setFullName} required />
      <TextField
        id="c-email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        required
      />
      <TextField
        id="c-pass"
        label="Temporary password"
        type="password"
        value={password}
        onChange={setPassword}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Portal"
          value={portalType}
          onChange={(v) => setPortalType(v as Portal)}
          options={["government", "private", "admin"]}
        />
        <SelectField
          label="Role"
          value={role}
          onChange={(v) => setRole(v as Role)}
          options={[...ROLES]}
        />
      </div>
      <SelectField
        label="Organisation"
        value={organizationId}
        onChange={setOrganizationId}
        options={["none", ...orgs.map((o) => o.id)]}
        labels={{ none: "No organisation", ...Object.fromEntries(orgs.map((o) => [o.id, o.name])) }}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="c-jur"
          label="Jurisdiction"
          value={jurisdiction}
          onChange={setJurisdiction}
        />
        <TextField
          id="c-oid"
          label="Official / employee ID"
          value={officialId}
          onChange={setOfficialId}
        />
      </div>
      <TextField id="c-desig" label="Designation" value={designation} onChange={setDesignation} />
      <DialogFooter>
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function EditForm({
  user,
  orgs,
  busy,
  onSubmit,
}: {
  user: {
    full_name: string | null;
    portal_type: string;
    roles: string[];
    organization_id: string | null;
    jurisdiction: string | null;
    official_id: string | null;
    designation: string | null;
    account_status: string;
  };
  orgs: Org[];
  busy: boolean;
  onSubmit: (v: Record<string, unknown>) => void;
}) {
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [portalType, setPortalType] = useState(user.portal_type);
  const [role, setRole] = useState(user.roles[0] ?? "inspector");
  const [organizationId, setOrganizationId] = useState(user.organization_id ?? "none");
  const [jurisdiction, setJurisdiction] = useState(user.jurisdiction ?? "");
  const [officialId, setOfficialId] = useState(user.official_id ?? "");
  const [designation, setDesignation] = useState(user.designation ?? "");
  const [accountStatus, setAccountStatus] = useState(user.account_status);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          fullName,
          portalType,
          role,
          organizationId: organizationId === "none" ? null : organizationId,
          jurisdiction: jurisdiction || null,
          officialId: officialId || null,
          designation: designation || null,
          accountStatus,
        });
      }}
    >
      <TextField id="e-name" label="Full name" value={fullName} onChange={setFullName} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Portal"
          value={portalType}
          onChange={setPortalType}
          options={["government", "private", "admin"]}
        />
        <SelectField label="Role" value={role} onChange={setRole} options={[...ROLES]} />
      </div>
      <SelectField
        label="Organisation"
        value={organizationId}
        onChange={setOrganizationId}
        options={["none", ...orgs.map((o) => o.id)]}
        labels={{ none: "No organisation", ...Object.fromEntries(orgs.map((o) => [o.id, o.name])) }}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="e-jur"
          label="Jurisdiction"
          value={jurisdiction}
          onChange={setJurisdiction}
        />
        <TextField
          id="e-oid"
          label="Official / employee ID"
          value={officialId}
          onChange={setOfficialId}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="e-desig" label="Designation" value={designation} onChange={setDesignation} />
        <SelectField
          label="Account status"
          value={accountStatus}
          onChange={setAccountStatus}
          options={["active", "suspended", "deactivated"]}
        />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  labels,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o} className="capitalize">
              {labels?.[o] ?? o.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
