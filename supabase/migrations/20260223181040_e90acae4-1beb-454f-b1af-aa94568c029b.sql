
-- Allow users to also see companies they created (needed for INSERT...RETURNING)
DROP POLICY IF EXISTS "Users can view their companies" ON public.companies;
CREATE POLICY "Users can view their companies" ON public.companies
  FOR SELECT TO authenticated
  USING (is_company_member(id) OR auth.uid() = created_by);
