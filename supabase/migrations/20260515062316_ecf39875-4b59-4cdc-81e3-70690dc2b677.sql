
-- Enums
CREATE TYPE public.task_status AS ENUM ('open', 'in_progress', 'waiting', 'done', 'blocked', 'question');
CREATE TYPE public.attachment_kind AS ENUM ('document', 'email');

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '',
  parent_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  depth INT NOT NULL DEFAULT 0,
  sort_order DOUBLE PRECISION NOT NULL DEFAULT 0,
  status public.task_status NOT NULL DEFAULT 'open',
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tasks_parent_idx ON public.tasks(parent_id);
CREATE INDEX tasks_sort_idx ON public.tasks(sort_order);

-- Attachments
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  kind public.attachment_kind NOT NULL DEFAULT 'document',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX attachments_task_idx ON public.attachments(task_id);

-- RLS: open (single-user app, no login)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open all" ON public.companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open all" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open all" ON public.attachments FOR ALL USING (true) WITH CHECK (true);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true);

CREATE POLICY "attachments read" ON storage.objects FOR SELECT USING (bucket_id = 'attachments');
CREATE POLICY "attachments insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'attachments');
CREATE POLICY "attachments update" ON storage.objects FOR UPDATE USING (bucket_id = 'attachments');
CREATE POLICY "attachments delete" ON storage.objects FOR DELETE USING (bucket_id = 'attachments');
