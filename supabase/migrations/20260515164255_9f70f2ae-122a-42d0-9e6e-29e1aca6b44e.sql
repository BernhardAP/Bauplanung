ALTER TABLE public.tasks
  ADD COLUMN planned_cost numeric,
  ADD COLUMN offered_price numeric,
  ADD COLUMN final_price numeric;