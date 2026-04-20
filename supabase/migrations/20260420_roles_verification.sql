-- Add verification fields to compliance_reports
ALTER TABLE compliance_reports
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_note TEXT;

-- Allow coordinators to read reports pending their verification
-- (Engineers need to see pending_verification reports even if they don't own the project)
CREATE POLICY IF NOT EXISTS "engineers can view pending verification reports"
  ON compliance_reports FOR SELECT
  USING (
    status = 'pending_verification'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'engineer'
    )
  );
