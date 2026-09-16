import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminRole =
  | "main_admin"
  | "super_admin"
  | "gov_admin"
  | "inspector"
  | "org_admin"
  | "org_user";

type Ctx = { supabase: any; userId: string };

async function assertMainAdmin(context: Ctx) {
  const { data, error } = await context.supabase.rpc("is_main_admin", { _user_id: context.userId });
  if (error) throw new Error("Could not verify administrator access");
  if (!data) throw new Error("Forbidden: main administrator access required");
  return context.userId;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function audit(actorId: string, action: string, metadata: Record<string, unknown>) {
  const db = await admin();
  await db.from("audit_logs").insert({ user_id: actorId, action, metadata: metadata as never });
}

/* ------------------------------- dashboard ------------------------------- */

export const adminStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMainAdmin(context as Ctx);
    const { data, error } = await (context as Ctx).supabase.rpc("admin_platform_stats");
    if (error) throw new Error(error.message);
    return (data ?? {}) as Record<string, number>;
  });

/* --------------------------------- users --------------------------------- */

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { search?: string; portal?: string; role?: string; status?: string }) => i)
  .handler(async ({ data, context }) => {
    const actor = await assertMainAdmin(context as Ctx);
    const db = await admin();

    const [{ data: profiles, error }, { data: roles }, { data: orgs }] = await Promise.all([
      db
        .from("profiles")
        .select(
          "id, full_name, email, portal_type, organization_id, official_id, designation, jurisdiction, account_status, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(500),
      db.from("user_roles").select("user_id, role"),
      db.from("organizations").select("id, name, organization_type"),
    ]);
    if (error) throw new Error(error.message);

    const roleBy = new Map<string, string[]>();
    for (const r of roles ?? []) {
      roleBy.set(r.user_id, [...(roleBy.get(r.user_id) ?? []), r.role]);
    }
    const orgBy = new Map((orgs ?? []).map((o) => [o.id, o]));

    let list = (profiles ?? []).map((p) => ({
      ...p,
      roles: roleBy.get(p.id) ?? [],
      organization_name: p.organization_id ? (orgBy.get(p.organization_id)?.name ?? null) : null,
    }));

    const q = data.search?.trim().toLowerCase();
    if (q) {
      list = list.filter((u) =>
        [u.full_name, u.email, u.official_id, u.jurisdiction, u.organization_name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    if (data.portal && data.portal !== "all") list = list.filter((u) => u.portal_type === data.portal);
    if (data.role && data.role !== "all") list = list.filter((u) => u.roles.includes(data.role!));
    if (data.status && data.status !== "all") list = list.filter((u) => u.account_status === data.status);

    await audit(actor, "admin_users_viewed", { count: list.length });
    return list;
  });

const UserInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  portalType: z.enum(["government", "private", "admin"]),
  role: z.enum(["main_admin", "super_admin", "gov_admin", "inspector", "org_admin", "org_user"]),
  organizationId: z.string().uuid().nullable().optional(),
  jurisdiction: z.string().nullable().optional(),
  officialId: z.string().nullable().optional(),
  designation: z.string().nullable().optional(),
});

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UserInput.parse(i))
  .handler(async ({ data, context }) => {
    const actor = await assertMainAdmin(context as Ctx);
    const db = await admin();

    const { data: created, error } = await db.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, portal_type: data.portalType },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create the account");

    const userId = created.user.id;
    await db
      .from("profiles")
      .upsert({
        id: userId,
        full_name: data.fullName,
        email: data.email,
        portal_type: data.portalType,
        organization_id: data.organizationId ?? null,
        jurisdiction: data.jurisdiction ?? null,
        official_id: data.officialId ?? null,
        designation: data.designation ?? null,
        account_status: "active",
      });
    await db.from("user_roles").delete().eq("user_id", userId);
    await db.from("user_roles").insert({ user_id: userId, role: data.role });

    await audit(actor, "admin_user_created", { user_id: userId, role: data.role, portal: data.portalType });
    return { id: userId };
  });

const UpdateInput = z.object({
  userId: z.string().uuid(),
  fullName: z.string().nullable().optional(),
  accountStatus: z.enum(["active", "suspended", "deactivated"]).optional(),
  organizationId: z.string().uuid().nullable().optional(),
  jurisdiction: z.string().nullable().optional(),
  officialId: z.string().nullable().optional(),
  designation: z.string().nullable().optional(),
  portalType: z.enum(["government", "private", "admin"]).optional(),
  role: z.enum(["main_admin", "super_admin", "gov_admin", "inspector", "org_admin", "org_user"]).optional(),
});

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpdateInput.parse(i))
  .handler(async ({ data, context }) => {
    const actor = await assertMainAdmin(context as Ctx);
    const db = await admin();

    const patch: Record<string, unknown> = {};
    if (data.fullName !== undefined) patch["full_name"] = data.fullName;
    if (data.accountStatus !== undefined) patch["account_status"] = data.accountStatus;
    if (data.organizationId !== undefined) patch["organization_id"] = data.organizationId;
    if (data.jurisdiction !== undefined) patch["jurisdiction"] = data.jurisdiction;
    if (data.officialId !== undefined) patch["official_id"] = data.officialId;
    if (data.designation !== undefined) patch["designation"] = data.designation;
    if (data.portalType !== undefined) patch["portal_type"] = data.portalType;

    if (Object.keys(patch).length) {
      const { error } = await db.from("profiles").update(patch).eq("id", data.userId);
      if (error) throw new Error(error.message);
    }

    if (data.role) {
      await db.from("user_roles").delete().eq("user_id", data.userId);
      const { error } = await db.from("user_roles").insert({ user_id: data.userId, role: data.role });
      if (error) throw new Error(error.message);
    }

    if (data.accountStatus) {
      await db.auth.admin.updateUserById(data.userId, {
        ban_duration: data.accountStatus === "active" ? "none" : "876000h",
      });
    }

    await audit(actor, "admin_user_updated", { user_id: data.userId, ...patch, role: data.role ?? null });
    return { ok: true };
  });

export const adminResetUserAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string; email: string }) => i)
  .handler(async ({ data, context }) => {
    const actor = await assertMainAdmin(context as Ctx);
    const db = await admin();
    const { error } = await db.auth.admin.generateLink({ type: "recovery", email: data.email });
    if (error) throw new Error(error.message);
    await audit(actor, "admin_user_access_reset", { user_id: data.userId });
    return { ok: true };
  });

/* ----------------------------- organizations ----------------------------- */

export const adminListOrganizations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { scope?: "all" | "government" | "business"; search?: string }) => i)
  .handler(async ({ data, context }) => {
    await assertMainAdmin(context as Ctx);
    const db = await admin();

    const [{ data: orgs, error }, { data: profiles }, { data: inspections }] = await Promise.all([
      db
        .from("organizations")
        .select("id, name, organization_type, jurisdiction, registration_number, status, verified_at, created_at")
        .order("created_at", { ascending: false }),
      db.from("profiles").select("id, organization_id, full_name, email, portal_type, account_status"),
      db.from("inspections").select("id, organization_id").is("deleted_at", null),
    ]);
    if (error) throw new Error(error.message);

    let list = (orgs ?? []).map((o) => ({
      ...o,
      user_count: (profiles ?? []).filter((p) => p.organization_id === o.id).length,
      inspection_count: (inspections ?? []).filter((i) => i.organization_id === o.id).length,
    }));

    if (data.scope === "government") list = list.filter((o) => o.organization_type === "government");
    if (data.scope === "business") list = list.filter((o) => o.organization_type !== "government");

    const q = data.search?.trim().toLowerCase();
    if (q) {
      list = list.filter((o) =>
        [o.name, o.jurisdiction, o.registration_number]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    return list;
  });

const OrgInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  organizationType: z.enum(["government", "private", "manufacturer", "retailer", "inspection_agency"]),
  jurisdiction: z.string().nullable().optional(),
  registrationNumber: z.string().nullable().optional(),
  status: z.enum(["active", "pending_verification", "verified", "suspended", "deactivated"]).optional(),
});

export const adminUpsertOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => OrgInput.parse(i))
  .handler(async ({ data, context }) => {
    const actor = await assertMainAdmin(context as Ctx);
    const db = await admin();

    const row = {
      name: data.name,
      organization_type: data.organizationType,
      jurisdiction: data.jurisdiction ?? null,
      registration_number: data.registrationNumber ?? null,
      ...(data.status ? { status: data.status } : {}),
      ...(data.status === "verified" ? { verified_at: new Date().toISOString() } : {}),
    };

    if (data.id) {
      const { error } = await db.from("organizations").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      await audit(actor, "admin_organization_updated", { organization_id: data.id, ...row });
      return { id: data.id };
    }
    const { data: created, error } = await db.from("organizations").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    await audit(actor, "admin_organization_created", { organization_id: created.id, ...row });
    return { id: created.id };
  });

/* -------------------------------- products -------------------------------- */

export const adminListProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { search?: string; status?: string }) => i)
  .handler(async ({ data, context }) => {
    await assertMainAdmin(context as Ctx);
    const db = await admin();

    const [{ data: products, error }, { data: inspections }] = await Promise.all([
      db
        .from("products")
        .select(
          "id, product_name, brand, manufacturer, barcode, package_type, product_category, net_quantity, inspection_status, external_source, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(500),
      db
        .from("inspections")
        .select("id, product_id, status, compliance_score, inspection_date")
        .is("deleted_at", null)
        .order("inspection_date", { ascending: false }),
    ]);
    if (error) throw new Error(error.message);

    let list = (products ?? []).map((p) => {
      const mine = (inspections ?? []).filter((i) => i.product_id === p.id);
      const latest = mine[0];
      return {
        ...p,
        inspection_count: mine.length,
        latest_status: latest?.status ?? null,
        latest_score: latest?.compliance_score ?? null,
        last_inspected: latest?.inspection_date ?? null,
      };
    });

    const q = data.search?.trim().toLowerCase();
    if (q) {
      list = list.filter((p) =>
        [p.product_name, p.brand, p.manufacturer, p.barcode, p.product_category]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    if (data.status && data.status !== "all") list = list.filter((p) => p.inspection_status === data.status);
    return list;
  });

/* ------------------------------ inspections ------------------------------ */

export const adminListInspections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: { search?: string; portal?: string; status?: string; from?: string; to?: string; risk?: string }) => i,
  )
  .handler(async ({ data, context }) => {
    const actor = await assertMainAdmin(context as Ctx);
    const db = await admin();

    let query = db
      .from("inspections")
      .select(
        "id, inspection_type, inspection_date, location_label, compliance_score, status, workflow_status, inspector_id, organization_id, product_id",
      )
      .is("deleted_at", null)
      .order("inspection_date", { ascending: false })
      .limit(500);
    if (data.from) query = query.gte("inspection_date", data.from);
    if (data.to) query = query.lte("inspection_date", data.to);
    if (data.status && data.status !== "all") query = query.eq("status", data.status);

    const [{ data: rows, error }, { data: profiles }, { data: orgs }, { data: products }, { data: violations }] =
      await Promise.all([
        query,
        db.from("profiles").select("id, full_name, email, portal_type"),
        db.from("organizations").select("id, name, organization_type"),
        db.from("products").select("id, product_name, brand"),
        db.from("violations").select("inspection_id, severity, status"),
      ]);
    if (error) throw new Error(error.message);

    const pBy = new Map((profiles ?? []).map((p) => [p.id, p]));
    const oBy = new Map((orgs ?? []).map((o) => [o.id, o]));
    const prBy = new Map((products ?? []).map((p) => [p.id, p]));

    let list = (rows ?? []).map((r) => {
      const v = (violations ?? []).filter((x) => x.inspection_id === r.id);
      const high = v.some((x) => x.severity === "high" || x.severity === "critical");
      return {
        ...r,
        inspector_name: pBy.get(r.inspector_id)?.full_name ?? pBy.get(r.inspector_id)?.email ?? "—",
        inspector_portal: pBy.get(r.inspector_id)?.portal_type ?? null,
        organization_name: r.organization_id ? (oBy.get(r.organization_id)?.name ?? null) : null,
        product_name: r.product_id ? (prBy.get(r.product_id)?.product_name ?? null) : null,
        violation_count: v.length,
        risk: high ? "high" : v.length ? "medium" : "low",
      };
    });

    if (data.portal && data.portal !== "all") list = list.filter((r) => r.inspector_portal === data.portal);
    if (data.risk && data.risk !== "all") list = list.filter((r) => r.risk === data.risk);

    const q = data.search?.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.id, r.product_name, r.inspector_name, r.organization_name, r.location_label]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }

    await audit(actor, "admin_inspections_viewed", { count: list.length });
    return list;
  });

/* --------------------------------- rules --------------------------------- */

export const adminListRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMainAdmin(context as Ctx);
    const db = await admin();
    const { data, error } = await db
      .from("compliance_rules")
      .select(
        "id, rule_code, rule_name, description, applicable_package_type, declaration_key, severity, version, effective_date, status",
      )
      .order("rule_code");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const RuleInput = z.object({
  id: z.string().uuid().optional(),
  ruleCode: z.string().min(2),
  ruleName: z.string().min(2),
  description: z.string().nullable().optional(),
  applicablePackageType: z.string().min(1),
  declarationKey: z.string().nullable().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["active", "inactive", "draft", "superseded", "retired"]),
  effectiveDate: z.string().optional(),
});

export const adminUpsertRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RuleInput.parse(i))
  .handler(async ({ data, context }) => {
    const actor = await assertMainAdmin(context as Ctx);
    const db = await admin();
    const row = {
      rule_code: data.ruleCode,
      rule_name: data.ruleName,
      description: data.description ?? null,
      applicable_package_type: data.applicablePackageType,
      declaration_key: data.declarationKey ?? null,
      severity: data.severity,
      status: data.status,
      ...(data.effectiveDate ? { effective_date: data.effectiveDate } : {}),
    };
    if (data.id) {
      const { error } = await db.from("compliance_rules").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      await audit(actor, "admin_rule_updated", { rule_id: data.id, code: data.ruleCode });
      return { id: data.id };
    }
    const { data: created, error } = await db.from("compliance_rules").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    await audit(actor, "admin_rule_created", { rule_id: created.id, code: data.ruleCode });
    return { id: created.id };
  });

/* ------------------------------ audit trail ------------------------------ */

export const adminListAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMainAdmin(context as Ctx);
    const db = await admin();
    const [{ data, error }, { data: profiles }] = await Promise.all([
      db.from("audit_logs").select("id, user_id, action, inspection_id, metadata, created_at").order("created_at", { ascending: false }).limit(100),
      db.from("profiles").select("id, full_name, email"),
    ]);
    if (error) throw new Error(error.message);
    const pBy = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (data ?? []).map((row) => ({
      ...row,
      actor: row.user_id ? (pBy.get(row.user_id)?.full_name ?? pBy.get(row.user_id)?.email ?? "—") : "System",
    }));
  });
