-- Trigger functions never need to be callable through the API
REVOKE ALL ON FUNCTION public.enforce_inspection_ownership() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_inspection_event() FROM PUBLIC, anon, authenticated;

-- Access-check helpers: keep them callable by signed-in users (RLS evaluates
-- them as the querying role) but never by anonymous visitors.
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_oversee_inspector(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_org_admin_of(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_oversee_inspector(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin_of(uuid, uuid) TO authenticated;