-- ============ product variants & barcode ============
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS parent_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_name text,
  ADD COLUMN IF NOT EXISTS net_quantity text;

CREATE INDEX IF NOT EXISTS products_barcode_idx ON public.products (barcode);

ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS barcode_source text,
  ADD COLUMN IF NOT EXISTS package_context text,
  ADD COLUMN IF NOT EXISTS product_match_score numeric,
  ADD COLUMN IF NOT EXISTS workflow_status text NOT NULL DEFAULT 'submitted';

CREATE INDEX IF NOT EXISTS inspections_barcode_idx ON public.inspections (barcode);

-- ============ supervisor_reviews ============
CREATE TABLE IF NOT EXISTS public.supervisor_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL,
  reviewer_id uuid,
  reason text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  decision text,
  reviewer_notes text
);

GRANT SELECT, INSERT, UPDATE ON public.supervisor_reviews TO authenticated;
GRANT ALL ON public.supervisor_reviews TO service_role;
ALTER TABLE public.supervisor_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews insert own inspection" ON public.supervisor_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND reviewer_id IS NULL
    AND status = 'pending'
    AND EXISTS (SELECT 1 FROM public.inspections i WHERE i.id = inspection_id AND i.inspector_id = auth.uid())
  );

CREATE POLICY "reviews read own or supervised" ON public.supervisor_reviews
  FOR SELECT TO authenticated
  USING (submitted_by = auth.uid() OR public.can_oversee_inspector(auth.uid(), submitted_by));

CREATE POLICY "reviews update by supervisor" ON public.supervisor_reviews
  FOR UPDATE TO authenticated
  USING (public.can_oversee_inspector(auth.uid(), submitted_by))
  WITH CHECK (public.can_oversee_inspector(auth.uid(), submitted_by));

-- ============ evidence_requests ============
CREATE TABLE IF NOT EXISTS public.evidence_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  review_id uuid REFERENCES public.supervisor_reviews(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  assigned_to uuid NOT NULL,
  request_description text,
  requested_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.evidence_requests TO authenticated;
GRANT ALL ON public.evidence_requests TO service_role;
ALTER TABLE public.evidence_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evidence requests read" ON public.evidence_requests
  FOR SELECT TO authenticated
  USING (assigned_to = auth.uid() OR requested_by = auth.uid() OR public.can_oversee_inspector(auth.uid(), assigned_to));

CREATE POLICY "evidence requests insert by supervisor" ON public.evidence_requests
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND public.can_oversee_inspector(auth.uid(), assigned_to));

CREATE POLICY "evidence requests update" ON public.evidence_requests
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR public.can_oversee_inspector(auth.uid(), assigned_to))
  WITH CHECK (assigned_to = auth.uid() OR public.can_oversee_inspector(auth.uid(), assigned_to));

-- ============ barcode_lookup_logs ============
CREATE TABLE IF NOT EXISTS public.barcode_lookup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  barcode text NOT NULL,
  barcode_format text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  lookup_source text NOT NULL DEFAULT 'internal',
  lookup_status text NOT NULL DEFAULT 'not_found',
  resulted_in_inspection boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.barcode_lookup_logs TO authenticated;
GRANT ALL ON public.barcode_lookup_logs TO service_role;
ALTER TABLE public.barcode_lookup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "barcode logs insert self" ON public.barcode_lookup_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "barcode logs read own or admin" ON public.barcode_lookup_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_oversee_inspector(auth.uid(), user_id));

-- ============ product_external_data ============
CREATE TABLE IF NOT EXISTS public.product_external_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  barcode text NOT NULL,
  source_name text NOT NULL,
  external_reference text,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified boolean NOT NULL DEFAULT false,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_external_data_barcode_source_idx
  ON public.product_external_data (barcode, source_name);

GRANT SELECT ON public.product_external_data TO authenticated;
GRANT ALL ON public.product_external_data TO service_role;
ALTER TABLE public.product_external_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "external product data read" ON public.product_external_data
  FOR SELECT TO authenticated USING (true);

-- ============ product_identity_matches ============
CREATE TABLE IF NOT EXISTS public.product_identity_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  barcode text,
  ocr_product_name text,
  database_product_name text,
  ocr_manufacturer text,
  database_manufacturer text,
  match_score numeric,
  status text NOT NULL DEFAULT 'matched',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.product_identity_matches TO authenticated;
GRANT ALL ON public.product_identity_matches TO service_role;
ALTER TABLE public.product_identity_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "identity matches read" ON public.product_identity_matches
  FOR SELECT TO authenticated USING (public.can_access_inspection(auth.uid(), inspection_id));
CREATE POLICY "identity matches insert" ON public.product_identity_matches
  FOR INSERT TO authenticated WITH CHECK (public.can_access_inspection(auth.uid(), inspection_id));

-- ============ workflow status protection ============
CREATE OR REPLACE FUNCTION public.guard_workflow_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.workflow_status IS DISTINCT FROM OLD.workflow_status
     AND COALESCE(current_setting('nirikshan.workflow', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Inspection workflow status can only be changed through the supervisor review process.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_workflow_status_trg ON public.inspections;
CREATE TRIGGER guard_workflow_status_trg
  BEFORE UPDATE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.guard_workflow_status();

CREATE OR REPLACE FUNCTION public.sync_review_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _target text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _target := 'submitted_for_review';
  ELSE
    _target := CASE NEW.status
      WHEN 'pending' THEN 'submitted_for_review'
      WHEN 'under_review' THEN 'under_supervisor_review'
      WHEN 'more_evidence_required' THEN 'more_evidence_required'
      WHEN 'approved' THEN 'approved'
      WHEN 'rejected' THEN 'rejected'
      WHEN 'escalated' THEN 'escalated'
      WHEN 'closed' THEN 'closed'
      ELSE NULL END;
  END IF;

  IF _target IS NOT NULL THEN
    PERFORM set_config('nirikshan.workflow', 'on', true);
    UPDATE public.inspections SET workflow_status = _target WHERE id = NEW.inspection_id;
    PERFORM set_config('nirikshan.workflow', 'off', true);
  END IF;

  INSERT INTO public.audit_logs (user_id, action, inspection_id, metadata)
  VALUES (COALESCE(auth.uid(), NEW.submitted_by),
          CASE WHEN TG_OP = 'INSERT' THEN 'review_requested' ELSE 'review_updated' END,
          NEW.inspection_id,
          jsonb_build_object('review_status', NEW.status, 'reason', NEW.reason, 'decision', NEW.decision));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_review_workflow_trg ON public.supervisor_reviews;
CREATE TRIGGER sync_review_workflow_trg
  AFTER INSERT OR UPDATE ON public.supervisor_reviews
  FOR EACH ROW EXECUTE FUNCTION public.sync_review_workflow();

-- allow the owning officer to update a finalized inspection while an evidence request is open
CREATE OR REPLACE FUNCTION public.enforce_inspection_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.guard_workflow_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_review_workflow() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_inspection_ownership() FROM PUBLIC, anon, authenticated;