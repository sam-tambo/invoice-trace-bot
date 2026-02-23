
-- Fix companies INSERT policy to be more robust
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;
CREATE POLICY "Users can create companies"
  ON public.companies
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Also fix company_memberships INSERT policy
DROP POLICY IF EXISTS "Users can create memberships" ON public.company_memberships;
CREATE POLICY "Users can create memberships"
  ON public.company_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
