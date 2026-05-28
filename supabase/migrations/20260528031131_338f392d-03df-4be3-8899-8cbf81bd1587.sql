
-- allowed_emails: restrict SELECT to admin only
DROP POLICY IF EXISTS "authenticated can read allowed emails" ON public.allowed_emails;
CREATE POLICY "only bernhard can read allowed emails"
ON public.allowed_emails FOR SELECT TO authenticated
USING (lower((auth.jwt() ->> 'email')) = 'bernhard.gruender@outlook.com');

-- companies
DROP POLICY IF EXISTS "open all" ON public.companies;
CREATE POLICY "authenticated read companies" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated update companies" ON public.companies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated delete companies" ON public.companies FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.companies FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;

-- tasks
DROP POLICY IF EXISTS "open all" ON public.tasks;
CREATE POLICY "authenticated read tasks" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated update tasks" ON public.tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated delete tasks" ON public.tasks FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.tasks FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;

-- attachments
DROP POLICY IF EXISTS "open all" ON public.attachments;
CREATE POLICY "authenticated read attachments" ON public.attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert attachments" ON public.attachments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated update attachments" ON public.attachments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated delete attachments" ON public.attachments FOR DELETE TO authenticated USING (true);
REVOKE ALL ON public.attachments FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;

-- status_settings: read for authenticated, write for admin only
DROP POLICY IF EXISTS "open all" ON public.status_settings;
CREATE POLICY "authenticated read status_settings" ON public.status_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "only bernhard insert status_settings" ON public.status_settings FOR INSERT TO authenticated
  WITH CHECK (lower((auth.jwt() ->> 'email')) = 'bernhard.gruender@outlook.com');
CREATE POLICY "only bernhard update status_settings" ON public.status_settings FOR UPDATE TO authenticated
  USING (lower((auth.jwt() ->> 'email')) = 'bernhard.gruender@outlook.com')
  WITH CHECK (lower((auth.jwt() ->> 'email')) = 'bernhard.gruender@outlook.com');
CREATE POLICY "only bernhard delete status_settings" ON public.status_settings FOR DELETE TO authenticated
  USING (lower((auth.jwt() ->> 'email')) = 'bernhard.gruender@outlook.com');
REVOKE ALL ON public.status_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.status_settings TO authenticated;

-- storage.objects: restrict attachments bucket to authenticated
DROP POLICY IF EXISTS "attachments read" ON storage.objects;
DROP POLICY IF EXISTS "attachments insert" ON storage.objects;
DROP POLICY IF EXISTS "attachments update" ON storage.objects;
DROP POLICY IF EXISTS "attachments delete" ON storage.objects;

CREATE POLICY "attachments read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'attachments');
CREATE POLICY "attachments insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments');
CREATE POLICY "attachments update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'attachments') WITH CHECK (bucket_id = 'attachments');
CREATE POLICY "attachments delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'attachments');
