-- compliance_rules: only active statutory rules are broadly readable; drafts/retired versions admin-only
DROP POLICY IF EXISTS "rules read" ON public.compliance_rules;
CREATE POLICY "rules read active or admin"
ON public.compliance_rules
FOR SELECT
TO authenticated
USING (
  status = 'active'
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gov_admin'::public.app_role)
);

-- product_external_data: cached third-party reference data is maintained only by the
-- server (service role) and reviewed by enforcement administrators.
DROP POLICY IF EXISTS "external product data read" ON public.product_external_data;
DROP POLICY IF EXISTS "product external data read" ON public.product_external_data;
DROP POLICY IF EXISTS "external data read" ON public.product_external_data;

CREATE POLICY "external product data admin read"
ON public.product_external_data
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gov_admin'::public.app_role)
);

CREATE POLICY "external product data admin insert"
ON public.product_external_data
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gov_admin'::public.app_role)
);

CREATE POLICY "external product data admin update"
ON public.product_external_data
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gov_admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gov_admin'::public.app_role)
);

CREATE POLICY "external product data admin delete"
ON public.product_external_data
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gov_admin'::public.app_role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_external_data TO authenticated;
GRANT ALL ON public.product_external_data TO service_role;
