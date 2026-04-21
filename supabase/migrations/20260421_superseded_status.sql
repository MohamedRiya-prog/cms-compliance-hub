-- Allow 'superseded' as a valid compliance_report status.
-- When a new revision is generated for a project+product_family,
-- previous revisions still in 'review' are automatically set to 'superseded'
-- so they no longer appear as pending review.

-- Drop the old check constraint if it exists and re-add it with 'superseded' included.
DO $$
BEGIN
  -- Try to drop any existing status check constraint on compliance_reports
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'compliance_reports'
      AND constraint_type = 'CHECK'
      AND constraint_name ILIKE '%status%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE compliance_reports DROP CONSTRAINT ' || constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'compliance_reports'
        AND constraint_type = 'CHECK'
        AND constraint_name ILIKE '%status%'
      LIMIT 1
    );
  END IF;
END $$;

ALTER TABLE compliance_reports
  ADD CONSTRAINT compliance_reports_status_check
  CHECK (status IN ('generating', 'review', 'error', 'verified', 'approved', 'pending_verification', 'superseded'));
