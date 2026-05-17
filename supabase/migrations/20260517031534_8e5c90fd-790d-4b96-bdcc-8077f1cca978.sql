
CREATE TABLE public.allowed_emails (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  invited_by text
);

INSERT INTO public.allowed_emails (email) VALUES
  ('gisela.gruender@gmx.de'),
  ('bernhard.gruender@outlook.com'),
  ('hoffmann@architekturundform.de');

ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

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
