-- Add revision tracking to compliance_reports
-- Run this in your Supabase SQL editor

ALTER TABLE compliance_reports
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_reports_family_revision
  ON compliance_reports (project_id, product_family, revision);
