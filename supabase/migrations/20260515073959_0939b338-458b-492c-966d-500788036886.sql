ALTER TYPE attachment_kind ADD VALUE IF NOT EXISTS 'link';
ALTER TABLE public.attachments ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE public.attachments ALTER COLUMN storage_path DROP NOT NULL;