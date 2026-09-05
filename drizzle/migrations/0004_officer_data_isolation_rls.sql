-- 1. Ownership / lifecycle columns
ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

UPDATE public.inspections
  SET finalized_at = COALESCE(finalized_at, inspection_date)
  WHERE status <> 'processing';

-- 2. Access helper functions
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.can_oversee_inspector(_admin_id uuid, _inspector_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_admin_id, 'super_admin')
    OR (
      public.has_role(_admin_id, 'gov_admin')
      AND EXISTS (
        SELECT 1 FROM public.profiles pa, public.profiles pi
        WHERE pa.id = _admin_id AND pi.id = _inspector_id
          AND pi.portal_type = 'government'
          AND (
            pa.jurisdiction IS NULL
            OR pi.jurisdiction IS NULL
            OR lower(pa.jurisdiction) = lower(pi.jurisdiction)
          )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin_of(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _org_id IS NOT NULL
     AND _org_id = public.my_org(_user_id)
     AND public.has_role(_user_id, 'org_admin');
$$;

CREATE OR REPLACE FUNCTION public.can_access_inspection(_user_id uuid, _inspection_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.inspections i
    WHERE i.id = _inspection_id
      AND (
        i.inspector_id = _user_id
        OR public.can_oversee_inspector(_user_id, i.inspector_id)
        OR public.is_org_admin_of(_user_id, i.organization_id)
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_oversee_inspector(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin_of(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_inspection(uuid, uuid) FROM anon;

-- 3. Enforce immutable ownership + finalization at the database level
CREATE OR REPLACE FUNCTION public.enforce_inspection_ownership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  -- UPDATE
  NEW.inspector_id := OLD.inspector_id;
  IF OLD.finalized_at IS NOT NULL
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'super_admin')
     AND NOT public.has_role(auth.uid(), 'gov_admin') THEN
    RAISE EXCEPTION 'This inspection is finalized. Ask an administrator to review any correction.';
  END IF;
  IF OLD.status = 'processing' AND NEW.status <> 'processing' THEN
    NEW.finalized_at := COALESCE(NEW.finalized_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_inspection_ownership_trg ON public.inspections;
CREATE TRIGGER enforce_inspection_ownership_trg
  BEFORE INSERT OR UPDATE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.enforce_inspection_ownership();

-- 4. Inspection policies: strict officer-level isolation
DROP POLICY IF EXISTS "inspections read" ON public.inspections;
DROP POLICY IF EXISTS "inspections insert" ON public.inspections;
DROP POLICY IF EXISTS "inspections update" ON public.inspections;

CREATE POLICY "inspections read own or supervised" ON public.inspections
  FOR SELECT TO authenticated
  USING (
    (deleted_at IS NULL OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'gov_admin'))
    AND (
      inspector_id = auth.uid()
      OR public.can_oversee_inspector(auth.uid(), inspector_id)
      OR public.is_org_admin_of(auth.uid(), organization_id)
    )
  );

CREATE POLICY "inspections insert own only" ON public.inspections
  FOR INSERT TO authenticated
  WITH CHECK (inspector_id = auth.uid());

CREATE POLICY "inspections update own unfinalized" ON public.inspections
  FOR UPDATE TO authenticated
  USING (
    (inspector_id = auth.uid() AND deleted_at IS NULL)
    OR public.has_role(auth.uid(), 'super_admin')
    OR (public.has_role(auth.uid(), 'gov_admin') AND public.can_oversee_inspector(auth.uid(), inspector_id))
  )
  WITH CHECK (
    inspector_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
    OR (public.has_role(auth.uid(), 'gov_admin') AND public.can_oversee_inspector(auth.uid(), inspector_id))
  );

-- 5. Products: creator, supervising admin, or org admin only
DROP POLICY IF EXISTS "products read" ON public.products;
DROP POLICY IF EXISTS "products update" ON public.products;

CREATE POLICY "products read own or supervised" ON public.products
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.can_oversee_inspector(auth.uid(), created_by)
    OR public.is_org_admin_of(auth.uid(), organization_id)
  );

CREATE POLICY "products update own or supervised" ON public.products
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_org_admin_of(auth.uid(), organization_id)
  );

-- 6. Profiles: self, supervising admin, org admin
DROP POLICY IF EXISTS "own profile select" ON public.profiles;
CREATE POLICY "profile select self or supervised" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.can_oversee_inspector(auth.uid(), id)
    OR public.is_org_admin_of(auth.uid(), organization_id)
  );

-- inspectors may not change their own privileged attributes
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'super_admin')
     AND NOT public.has_role(auth.uid(), 'gov_admin') THEN
    NEW.organization_id := OLD.organization_id;
    NEW.official_id := OLD.official_id;
    NEW.portal_type := OLD.portal_type;
    NEW.jurisdiction := OLD.jurisdiction;
    NEW.designation := OLD.designation;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_fields_trg ON public.profiles;
CREATE TRIGGER protect_profile_fields_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- 7. Audit log
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  inspection_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit read own or admin" ON public.audit_logs;
CREATE POLICY "audit read own or admin" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_oversee_inspector(auth.uid(), user_id));

DROP POLICY IF EXISTS "audit insert self" ON public.audit_logs;
CREATE POLICY "audit insert self" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.log_inspection_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, inspection_id, metadata)
  VALUES (
    COALESCE(auth.uid(), NEW.inspector_id),
    CASE WHEN TG_OP = 'INSERT' THEN 'inspection_created' ELSE 'inspection_updated' END,
    NEW.id,
    jsonb_build_object('status', NEW.status, 'compliance_score', NEW.compliance_score)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_inspection_event_trg ON public.inspections;
CREATE TRIGGER log_inspection_event_trg
  AFTER INSERT OR UPDATE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.log_inspection_event();

REVOKE EXECUTE ON FUNCTION public.enforce_inspection_ownership() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_fields() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_inspection_event() FROM anon, authenticated;

-- 8. Storage: evidence images readable only by owner or supervising admin
DROP POLICY IF EXISTS "label images read" ON storage.objects;
CREATE POLICY "label images read own or supervised" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'label-images'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.can_oversee_inspector(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  );