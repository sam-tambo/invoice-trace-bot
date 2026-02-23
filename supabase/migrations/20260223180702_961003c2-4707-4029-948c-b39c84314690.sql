
-- Drop ALL restrictive policies on companies and company_memberships and recreate as PERMISSIVE

-- companies
DROP POLICY IF EXISTS "Users can view their companies" ON public.companies;
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Owners can update companies" ON public.companies;

CREATE POLICY "Users can view their companies" ON public.companies FOR SELECT TO authenticated USING (is_company_member(id));
CREATE POLICY "Users can create companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owners can update companies" ON public.companies FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM company_memberships WHERE company_memberships.company_id = companies.id AND company_memberships.user_id = auth.uid() AND company_memberships.role = 'owner'));

-- company_memberships
DROP POLICY IF EXISTS "Members can view memberships" ON public.company_memberships;
DROP POLICY IF EXISTS "Users can insert memberships" ON public.company_memberships;
DROP POLICY IF EXISTS "Users can create memberships" ON public.company_memberships;

CREATE POLICY "Members can view memberships" ON public.company_memberships FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Users can create memberships" ON public.company_memberships FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- invoices
DROP POLICY IF EXISTS "Members can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Members can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Members can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Members can delete invoices" ON public.invoices;

CREATE POLICY "Members can view invoices" ON public.invoices FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id));
CREATE POLICY "Members can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can delete invoices" ON public.invoices FOR DELETE TO authenticated USING (is_company_member(company_id));

-- suppliers
DROP POLICY IF EXISTS "Members can view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Members can insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Members can update suppliers" ON public.suppliers;

CREATE POLICY "Members can view suppliers" ON public.suppliers FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id));
CREATE POLICY "Members can update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (is_company_member(company_id));

-- message_templates
DROP POLICY IF EXISTS "Members can view templates" ON public.message_templates;
DROP POLICY IF EXISTS "Members can insert templates" ON public.message_templates;
DROP POLICY IF EXISTS "Members can update templates" ON public.message_templates;
DROP POLICY IF EXISTS "Members can delete templates" ON public.message_templates;

CREATE POLICY "Members can view templates" ON public.message_templates FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can insert templates" ON public.message_templates FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id));
CREATE POLICY "Members can update templates" ON public.message_templates FOR UPDATE TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can delete templates" ON public.message_templates FOR DELETE TO authenticated USING (is_company_member(company_id));

-- outreach_logs
DROP POLICY IF EXISTS "Members can view outreach" ON public.outreach_logs;
DROP POLICY IF EXISTS "Members can insert outreach" ON public.outreach_logs;

CREATE POLICY "Members can view outreach" ON public.outreach_logs FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can insert outreach" ON public.outreach_logs FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id));

-- attachments
DROP POLICY IF EXISTS "Members can view attachments" ON public.attachments;
DROP POLICY IF EXISTS "Members can insert attachments" ON public.attachments;

CREATE POLICY "Members can view attachments" ON public.attachments FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can insert attachments" ON public.attachments FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id));
