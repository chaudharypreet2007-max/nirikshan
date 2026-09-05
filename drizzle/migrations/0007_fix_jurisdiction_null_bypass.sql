create or replace function public.can_oversee_inspector(_admin_id uuid, _inspector_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin(_admin_id)
    or (
      public.has_role(_admin_id, 'gov_admin'::public.app_role)
      and exists (
        select 1
        from public.profiles a
        join public.profiles i on i.id = _inspector_id
        where a.id = _admin_id
          and a.jurisdiction is not null
          and i.jurisdiction is not null
          and a.jurisdiction = i.jurisdiction
      )
    )
$$;