-- Convert tasks.status from enum to text so statuses can be freely added/removed
ALTER TABLE public.tasks ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.tasks ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.tasks ALTER COLUMN status SET DEFAULT 'open';
DROP TYPE IF EXISTS public.task_status;