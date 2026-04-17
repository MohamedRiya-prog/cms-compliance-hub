-- Add display label and group to product_data for dynamic product management
ALTER TABLE product_data ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE product_data ADD COLUMN IF NOT EXISTS product_group text;
