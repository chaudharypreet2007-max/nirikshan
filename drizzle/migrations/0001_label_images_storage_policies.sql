CREATE POLICY "label images upload own folder" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'label-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "label images read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'label-images' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_gov(auth.uid())));

CREATE POLICY "label images delete own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'label-images' AND (storage.foldername(name))[1] = auth.uid()::text);