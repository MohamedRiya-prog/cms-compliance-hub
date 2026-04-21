-- Managed divisions list (admin can add/remove)
CREATE TABLE IF NOT EXISTS divisions (
  id   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);
INSERT INTO divisions (name) VALUES ('GD & ACC') ON CONFLICT DO NOTHING;

-- Admins can have a functional role (e.g. 'engineer') so they appear
-- in the team presence panel and verification flows
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS functional_role text;
