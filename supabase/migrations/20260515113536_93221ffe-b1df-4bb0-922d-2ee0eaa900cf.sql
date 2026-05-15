CREATE TABLE public.status_settings (
  status text PRIMARY KEY,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  color text
);

ALTER TABLE public.status_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open all" ON public.status_settings FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.status_settings (status, label, sort_order, color) VALUES
  ('open', 'Offen', 0, NULL),
  ('in_progress', 'In Arbeit', 1, NULL),
  ('waiting', 'Wartet', 2, NULL),
  ('question', 'Frage', 3, NULL),
  ('blocked', 'Blockiert', 4, NULL),
  ('done', 'Erledigt', 5, NULL);