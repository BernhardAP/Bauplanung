-- Allowlist: nur diese E-Mails dürfen sich registrieren
CREATE OR REPLACE FUNCTION public.enforce_email_allowlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) NOT IN (
    'gisela.gruender@gmx.de',
    'bernhard.gruender@outlook.com'
  ) THEN
    RAISE EXCEPTION 'Diese E-Mail-Adresse ist nicht für den Zugriff freigegeben.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_email_allowlist_trigger ON auth.users;
CREATE TRIGGER enforce_email_allowlist_trigger
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.enforce_email_allowlist();