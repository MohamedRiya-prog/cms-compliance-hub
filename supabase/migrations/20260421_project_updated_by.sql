-- Track which user last edited a project
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
