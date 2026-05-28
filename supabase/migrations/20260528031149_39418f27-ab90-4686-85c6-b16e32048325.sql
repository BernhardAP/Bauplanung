
-- companies
DROP POLICY IF EXISTS "authenticated insert companies" ON public.companies;
DROP POLICY IF EXISTS "authenticated update companies" ON public.companies;
DROP POLICY IF EXISTS "authenticated delete companies" ON public.companies;
CREATE POLICY "authenticated insert companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update companies" ON public.companies FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated delete companies" ON public.companies FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- tasks
DROP POLICY IF EXISTS "authenticated insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "authenticated update tasks" ON public.tasks;
DROP POLICY IF EXISTS "authenticated delete tasks" ON public.tasks;
CREATE POLICY "authenticated insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update tasks" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated delete tasks" ON public.tasks FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- attachments
DROP POLICY IF EXISTS "authenticated insert attachments" ON public.attachments;
DROP POLICY IF EXISTS "authenticated update attachments" ON public.attachments;
DROP POLICY IF EXISTS "authenticated delete attachments" ON public.attachments;
CREATE POLICY "authenticated insert attachments" ON public.attachments FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update attachments" ON public.attachments FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated delete attachments" ON public.attachments FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- storage.objects (attachments bucket)
DROP POLICY IF EXISTS "attachments insert" ON storage.objects;
DROP POLICY IF EXISTS "attachments update" ON storage.objects;
DROP POLICY IF EXISTS "attachments delete" ON storage.objects;
CREATE POLICY "attachments insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments' AND auth.uid() IS NOT NULL);
CREATE POLICY "attachments update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'attachments' AND auth.uid() IS NOT NULL)
  WITH CHECK (bucket_id = 'attachments' AND auth.uid() IS NOT NULL);
CREATE POLICY "attachments delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'attachments' AND auth.uid() IS NOT NULL);
