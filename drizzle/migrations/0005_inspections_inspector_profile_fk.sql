ALTER TABLE public.inspections
  ADD CONSTRAINT inspections_inspector_id_fkey
  FOREIGN KEY (inspector_id) REFERENCES public.profiles(id) ON DELETE CASCADE;