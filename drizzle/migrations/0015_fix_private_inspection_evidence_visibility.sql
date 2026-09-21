DROP POLICY IF EXISTS "label images read own or supervised" ON storage.objects;

CREATE POLICY "label images read authorized inspection evidence"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'label-images'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_main_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.inspections i
      WHERE public.can_access_inspection(auth.uid(), i.id)
        AND (
          i.image_path = storage.objects.name
          OR COALESCE(i.ai_raw -> 'image_paths', '[]'::jsonb) ? storage.objects.name
        )
    )
  )
);