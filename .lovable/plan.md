# Main Administration Portal

A separate, top-level administration area for Nirikshan AI that oversees both the Government Enforcement portal and the Business portal. Nothing in the existing portals changes — officers, supervisors and business users keep working exactly as today.

## Access

- New sign-in page at `/admin/login` with the Nirikshan AI mark, "Main Administration Portal", the tagline "Scan. Detect. Verify. Comply.", show/hide password, loading and invalid-credential states, and forgot-password.
- After sign-in, only accounts holding the new highest-level role reach `/admin/dashboard`; anyone else is signed out of the admin area with a clear message.
- Separate from the government and business sign-in pages; sign-out and session expiry return to `/admin/login`.
- Permission is checked in the database itself, not just in the screens, so the admin area cannot be reached by editing the address bar.

## Screens

1. **Dashboard** — platform KPIs: total users, government users, business users, inspectors, organisations, businesses, products, inspections, compliant / non-compliant, pending reviews, open violations, high-risk products, suspended and active accounts. Cards plus a compliance trend chart and a recent-activity table.
2. **Platform overview** — one page with an All / Government / Business switch. Government side: organisations, administrators, active inspectors, inspections completed and pending, violations, high-risk inspections, supervisor reviews, activity by jurisdiction. Business side: organisations by type, active users, products registered, inspections, compliance split.
3. **User management** — searchable, filterable list of every account with portal, role, organisation, status, created date and last activity. Create, edit, activate, deactivate, suspend, reset access, change role, change organisation. Granting the highest role is restricted and always recorded.
4. **Government management** — government organisations (add, edit, activate/deactivate, assign administrators, view inspectors) plus inspector and administrator administration with jurisdiction assignment.
5. **Business management** — organisations of type manufacturer, retailer, inspection agency, private company, other: register, edit, verify, approve, suspend, deactivate, assign an organisation administrator, view statistics. Plus business user administration.
6. **Product management** — the full product repository with search, filters, sorting and a detail view showing product facts, inspection history and any externally fetched information. Barcode remains a discovery aid only, never a permission.
7. **Inspection management** — platform-wide inspection records with filters for portal, inspector, organisation, date range, product, compliance status, violation type and risk. Every admin view is written to the audit trail.
8. **Legal Metrology rules** — view, add, edit, enable/disable rules, set applicability, package categories, declaration requirements, severity and versions.

## Technical outline

- New `main_admin` value on the `app_role` enum; a `public.is_main_admin(uuid)` security-definer helper; `admin` added as an allowed `portal_type` use for these accounts.
- New `account_status` column on `profiles` (`active` / `suspended` / `deactivated`, default `active`) and a `status` column on `organizations` (`active` / `pending_verification` / `verified` / `suspended`), both nullable-with-default so existing rows are unaffected.
- Additional RLS policies granting `main_admin` read across `profiles`, `organizations`, `products`, `inspections`, `violations`, `extracted_declarations`, `supervisor_reviews`, `evidence_requests`, `compliance_rules`, `audit_logs`, and write where the screens above require it. Existing officer-isolation policies stay untouched — the new policies are additive.
- `protect_profile_fields()` extended so `main_admin` may administer any profile; ordinary users still cannot self-assign role, jurisdiction, organisation or portal.
- All admin actions go through server functions using the signed-in admin's own session (`requireSupabaseAuth`) plus an explicit role check; role grants and account status changes use the privileged client only after that check and write an `audit_logs` row.
- Routes under `src/routes/admin/` with their own layout and sidebar; `/admin/login` is public, everything else is gated client-side and enforced server-side.
- Aggregate counts come from SQL aggregate views/functions so the dashboard stays fast as data grows.

## Delivery order

1. Database: role, helpers, status columns, policies, audit hooks.
2. Admin login, layout, route gate, sign-out.
3. Dashboard and platform overview.
4. User management, government management, business management.
5. Product, inspection and rule management.

One existing account must be promoted to the new role to sign in for the first time — tell me which email to promote, or I will promote the first super admin.
