-- 1. SECURITY DEFINER functions: remove PUBLIC/anon execute access.
--    handle_new_user is a trigger function only: no API role needs EXECUTE.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_gov(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_gov(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.my_org(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_org(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.can_access_inspection(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_inspection(uuid, uuid) TO authenticated, service_role;

-- 2. organizations: only enforcement admins may create organizations.
--    Private-portal organizations are created by the signup trigger (SECURITY DEFINER),
--    so ordinary authenticated users no longer need INSERT rights.
DROP POLICY IF EXISTS "orgs insert" ON public.organizations;
CREATE POLICY "orgs insert" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gov_admin'::public.app_role)
  );

-- 3. label-images storage: explicit owner-scoped UPDATE policy.
DROP POLICY IF EXISTS "label images update own" ON storage.objects;
CREATE POLICY "label images update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'label-images' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'label-images' AND (storage.foldername(name))[1] = auth.uid()::text);
