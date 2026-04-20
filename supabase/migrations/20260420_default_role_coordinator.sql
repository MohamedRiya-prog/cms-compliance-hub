-- Change default role for new users to 'coordinator'
-- Existing users keep their current role unchanged.
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'coordinator';

-- Update the new-user trigger so it explicitly inserts 'coordinator'
-- (in case the trigger hardcodes 'engineer' rather than relying on the column default)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    'coordinator'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;
