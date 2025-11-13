ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS position TEXT;

UPDATE public.profiles
SET position = NULL
WHERE position IS NULL;
