-- 1. Helper
CREATE OR REPLACE FUNCTION public.is_main_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'main_admin');
$$;

REVOKE EXECUTE ON FUNCTION public.is_main_admin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_main_admin(uuid) TO authenticated, service_role;

-- 2. Status columns (additive, defaulted)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- 3. Profile field protection: main admins may administer any profile
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  is_super boolean;
  is_gov_admin boolean;
  is_main boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  is_main := public.is_main_admin(auth.uid());
  is_super := public.has_role(auth.uid(), 'super_admin');
  is_gov_admin := public.has_role(auth.uid(), 'gov_admin');

  IF TG_OP = 'INSERT' THEN
    IF NOT (is_super OR is_main) THEN
      NEW.official_id := NULL;
      NEW.jurisdiction := NULL;
      NEW.designation := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF is_super OR is_main THEN
    RETURN NEW;
  END IF;

  IF is_gov_admin AND NEW.id <> auth.uid() THEN
    NEW.portal_type := OLD.portal_type;
    RETURN NEW;
  END IF;

  NEW.organization_id := OLD.organization_id;
  NEW.official_id := OLD.official_id;
  NEW.portal_type := OLD.portal_type;
  NEW.jurisdiction := OLD.jurisdiction;
  NEW.designation := OLD.designation;
  NEW.account_status := OLD.account_status;
  RETURN NEW;
END;
$function$;

-- 4. Inspection ownership trigger: main admins may correct finalized records
CREATE OR REPLACE FUNCTION public.enforce_inspection_ownership()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.inspector_id := auth.uid();
    END IF;
    IF NEW.status <> 'processing' THEN
      NEW.finalized_at := COALESCE(NEW.finalized_at, now());
    END IF;
    RETURN NEW;
  END IF;

  NEW.inspector_id := OLD.inspector_id;
  IF OLD.finalized_at IS NOT NULL
     AND auth.uid() IS NOT NULL
     AND NOT public.is_main_admin(auth.uid())
     AND NOT public.has_role(auth.uid(), 'super_admin')
     AND NOT public.has_role(auth.uid(), 'gov_admin')
     AND NOT EXISTS (
       SELECT 1 FROM public.evidence_requests er
       WHERE er.inspection_id = OLD.id
         AND er.assigned_to = auth.uid()
         AND er.status = 'open'
     ) THEN
    RAISE EXCEPTION 'This inspection is finalized. Ask an administrator to review any correction.';
  END IF;
  IF OLD.status = 'processing' AND NEW.status <> 'processing' THEN
    NEW.finalized_at := COALESCE(NEW.finalized_at, now());
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. Additive main-admin RLS policies
CREATE POLICY "main admin read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_main_admin(auth.uid()));
CREATE POLICY "main admin write profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_main_admin(auth.uid())) WITH CHECK (public.is_main_admin(auth.uid()));
CREATE POLICY "main admin insert profiles" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.is_main_admin(auth.uid()));

CREATE POLICY "main admin read organizations" ON public.organizations
  FOR SELECT TO authenticated USING (public.is_main_admin(auth.uid()));
CREATE POLICY "main admin insert organizations" ON public.organizations
  FOR INSERT TO authenticated WITH CHECK (public.is_main_admin(auth.uid()));
CREATE POLICY "main admin update organizations" ON public.organizations
  FOR UPDATE TO authenticated USING (public.is_main_admin(auth.uid())) WITH CHECK (public.is_main_admin(auth.uid()));

CREATE POLICY "main admin read user roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_main_admin(auth.uid()));
CREATE POLICY "main admin insert user roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.is_main_admin(auth.uid()));
CREATE POLICY "main admin delete user roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.is_main_admin(auth.uid()));

CREATE POLICY "main admin read products" ON public.products
  FOR SELECT TO authenticated USING (public.is_main_admin(auth.uid()));
CREATE POLICY "main admin update products" ON public.products
  FOR UPDATE TO authenticated USING (public.is_main_admin(auth.uid())) WITH CHECK (public.is_main_admin(auth.uid()));

CREATE POLICY "main admin read inspections" ON public.inspections
  FOR SELECT TO authenticated USING (public.is_main_admin(auth.uid()));
CREATE POLICY "main admin read violations" ON public.violations
  FOR SELECT TO authenticated USING (public.is_main_admin(auth.uid()));
CREATE POLICY "main admin read declarations" ON public.extracted_declarations
  FOR SELECT TO authenticated USING (public.is_main_admin(auth.uid()));
CREATE POLICY "main admin read reviews" ON public.supervisor_reviews
  FOR SELECT TO authenticated USING (public.is_main_admin(auth.uid()));
CREATE POLICY "main admin read evidence requests" ON public.evidence_requests
  FOR SELECT TO authenticated USING (public.is_main_admin(auth.uid()));
CREATE POLICY "main admin read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_main_admin(auth.uid()));
CREATE POLICY "main admin read all rules" ON public.compliance_rules
  FOR SELECT TO authenticated USING (public.is_main_admin(auth.uid()));
CREATE POLICY "main admin insert rules" ON public.compliance_rules
  FOR INSERT TO authenticated WITH CHECK (public.is_main_admin(auth.uid()));
CREATE POLICY "main admin update rules" ON public.compliance_rules
  FOR UPDATE TO authenticated USING (public.is_main_admin(auth.uid())) WITH CHECK (public.is_main_admin(auth.uid()));
CREATE POLICY "main admin read external product data" ON public.product_external_data
  FOR SELECT TO authenticated USING (public.is_main_admin(auth.uid()));
CREATE POLICY "main admin read identity matches" ON public.product_identity_matches
  FOR SELECT TO authenticated USING (public.is_main_admin(auth.uid()));
CREATE POLICY "main admin read barcode logs" ON public.barcode_lookup_logs
  FOR SELECT TO authenticated USING (public.is_main_admin(auth.uid()));

-- 6. Platform statistics (aggregate only, admin restricted)
CREATE OR REPLACE FUNCTION public.admin_platform_stats()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_main_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'government_users', (SELECT count(*) FROM public.profiles WHERE portal_type = 'government'),
    'business_users', (SELECT count(*) FROM public.profiles WHERE portal_type = 'private'),
    'inspectors', (SELECT count(*) FROM public.user_roles WHERE role = 'inspector'),
    'gov_admins', (SELECT count(*) FROM public.user_roles WHERE role = 'gov_admin'),
    'org_admins', (SELECT count(*) FROM public.user_roles WHERE role = 'org_admin'),
    'suspended_accounts', (SELECT count(*) FROM public.profiles WHERE account_status <> 'active'),
    'organizations', (SELECT count(*) FROM public.organizations),
    'active_organizations', (SELECT count(*) FROM public.organizations WHERE status = 'active'),
    'gov_organizations', (SELECT count(*) FROM public.organizations WHERE organization_type = 'government'),
    'business_organizations', (SELECT count(*) FROM public.organizations WHERE organization_type <> 'government'),
    'manufacturers', (SELECT count(*) FROM public.organizations WHERE organization_type = 'manufacturer'),
    'retailers', (SELECT count(*) FROM public.organizations WHERE organization_type = 'retailer'),
    'inspection_agencies', (SELECT count(*) FROM public.organizations WHERE organization_type = 'inspection_agency'),
    'products', (SELECT count(*) FROM public.products),
    'inspections', (SELECT count(*) FROM public.inspections WHERE deleted_at IS NULL),
    'compliant', (SELECT count(*) FROM public.inspections WHERE deleted_at IS NULL AND status = 'compliant'),
    'non_compliant', (SELECT count(*) FROM public.inspections WHERE deleted_at IS NULL AND status = 'non_compliant'),
    'needs_review', (SELECT count(*) FROM public.inspections WHERE deleted_at IS NULL AND status = 'needs_review'),
    'processing', (SELECT count(*) FROM public.inspections WHERE deleted_at IS NULL AND status = 'processing'),
    'gov_inspections', (SELECT count(*) FROM public.inspections i JOIN public.profiles p ON p.id = i.inspector_id WHERE i.deleted_at IS NULL AND p.portal_type = 'government'),
    'business_inspections', (SELECT count(*) FROM public.inspections i JOIN public.profiles p ON p.id = i.inspector_id WHERE i.deleted_at IS NULL AND p.portal_type = 'private'),
    'pending_reviews', (SELECT count(*) FROM public.supervisor_reviews WHERE status IN ('pending','under_review','more_evidence_required')),
    'total_reviews', (SELECT count(*) FROM public.supervisor_reviews),
    'open_violations', (SELECT count(*) FROM public.violations WHERE status <> 'resolved'),
    'high_risk', (SELECT count(*) FROM public.violations WHERE severity IN ('high','critical')),
    'high_risk_inspections', (SELECT count(DISTINCT v.inspection_id) FROM public.violations v WHERE v.severity IN ('high','critical'))
  ) INTO result;

  RETURN result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_platform_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_platform_stats() TO authenticated, service_role;