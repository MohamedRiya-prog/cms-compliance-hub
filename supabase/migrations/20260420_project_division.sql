-- Add division to projects so access can be scoped per division
ALTER TABLE projects ADD COLUMN IF NOT EXISTS division text;
