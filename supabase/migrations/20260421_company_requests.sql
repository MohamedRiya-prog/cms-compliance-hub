-- Company add requests: users submit, admins approve/reject
CREATE TABLE IF NOT EXISTS public.company_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  types        text[] NOT NULL DEFAULT '{}',
  city         text,
  country      text,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_requests ENABLE ROW LEVEL SECURITY;

-- Admins (service role) manage all rows; regular users can only insert their own
CREATE POLICY "Users can insert own requests"
  ON public.company_requests FOR INSERT
  TO authenticated
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Admins can read all requests"
  ON public.company_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
