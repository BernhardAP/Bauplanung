CREATE OR REPLACE FUNCTION public.enforce_email_allowlist()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF lower(NEW.email) NOT IN (
    'gisela.gruender@gmx.de',
    'bernhard.gruender@outlook.com',
    'hoffmann@architekturundform.de'
  ) THEN
    RAISE EXCEPTION 'Diese E-Mail-Adresse ist nicht für den Zugriff freigegeben.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;