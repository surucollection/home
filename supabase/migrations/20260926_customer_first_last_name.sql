ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

UPDATE public.customers
SET
  first_name = COALESCE(NULLIF(first_name, ''), split_part(trim(COALESCE(name, '')), ' ', 1)),
  last_name = COALESCE(
    NULLIF(last_name, ''),
    NULLIF(trim(regexp_replace(trim(COALESCE(name, '')), '^\\S+\\s*', '')), '')
  )
WHERE first_name IS NULL OR first_name = '' OR last_name IS NULL OR last_name = '';
