-- Enums
CREATE TYPE public.attachment_kind AS ENUM ('document', 'email', 'link');

-- Companies
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kuerzel TEXT NOT NULL,
  kontaktperson TEXT,
  telefon TEXT,
  email TEXT,
  adresse TEXT,
  web TEXT,
  notes TEXT,
  is_default_cc BOOLEAN NOT NULL DEFAULT false,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Status settings
CREATE TABLE public.status_settings (
  status text PRIMARY KEY,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  color text,
  icon text
);

INSERT INTO public.status_settings (status, label, sort_order, color) VALUES
  ('open', 'Offen', 0, NULL),
  ('in_progress', 'In Arbeit', 1, NULL),
  ('waiting', 'Wartet', 2, NULL),
  ('question', 'Frage', 3, NULL),
  ('blocked', 'Blockiert', 4, NULL),
  ('done', 'Erledigt', 5, NULL);

-- Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '',
  parent_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  depth INT NOT NULL DEFAULT 0,
  sort_order DOUBLE PRECISION NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  planned_cost numeric,
  offered_price numeric,
  final_price numeric,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tasks_parent_idx ON public.tasks(parent_id);
CREATE INDEX tasks_sort_idx ON public.tasks(sort_order);

-- Attachments
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_path TEXT,
  mime_type TEXT,
  url text,
  kind public.attachment_kind NOT NULL DEFAULT 'document',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX attachments_task_idx ON public.attachments(task_id);

-- Allowed emails
CREATE TABLE public.allowed_emails (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  invited_by text
);

INSERT INTO public.allowed_emails (email) VALUES
  ('gisela.gruender@gmx.de'),
  ('bernhard.gruender@outlook.com'),
  ('hoffmann@architekturundform.de');

-- RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open all" ON public.companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open all" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open all" ON public.attachments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open all" ON public.status_settings FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "authenticated can read allowed emails"
  ON public.allowed_emails FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "only bernhard can insert"
  ON public.allowed_emails FOR INSERT
  TO authenticated
  WITH CHECK (lower((auth.jwt() ->> 'email')) = 'bernhard.gruender@outlook.com');

CREATE POLICY "only bernhard can delete"
  ON public.allowed_emails FOR DELETE
  TO authenticated
  USING (lower((auth.jwt() ->> 'email')) = 'bernhard.gruender@outlook.com');

-- Email allowlist trigger
CREATE OR REPLACE FUNCTION public.enforce_email_allowlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.allowed_emails WHERE lower(email) = lower(NEW.email)
  ) THEN
    RAISE EXCEPTION 'Diese E-Mail-Adresse ist nicht für den Zugriff freigegeben.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.enforce_email_allowlist() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_email_allowlist_trigger ON auth.users;
CREATE TRIGGER enforce_email_allowlist_trigger
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.enforce_email_allowlist();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true);

CREATE POLICY "attachments read" ON storage.objects FOR SELECT USING (bucket_id = 'attachments');
CREATE POLICY "attachments insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'attachments');
CREATE POLICY "attachments update" ON storage.objects FOR UPDATE USING (bucket_id = 'attachments');
CREATE POLICY "attachments delete" ON storage.objects FOR DELETE USING (bucket_id = 'attachments');