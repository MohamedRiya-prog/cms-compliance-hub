-- Add division to product_data (high-level grouping, e.g. "GD & ACC")
ALTER TABLE product_data ADD COLUMN IF NOT EXISTS division text;
UPDATE product_data SET division = 'GD & ACC' WHERE division IS NULL;

-- Add divisions array to profiles (coordinators/engineers can belong to multiple divisions)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS divisions text[] DEFAULT '{}';
