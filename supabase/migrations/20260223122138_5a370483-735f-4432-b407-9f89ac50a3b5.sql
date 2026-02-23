
-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (user_id = auth.uid());

-- Companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  nif TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Company memberships table
CREATE TABLE public.company_memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);
ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;

-- Helper function (now tables exist)
CREATE OR REPLACE FUNCTION public.is_company_member(p_company_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE company_id = p_company_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- RLS for companies
CREATE POLICY "Users can view their companies" ON public.companies FOR SELECT USING (public.is_company_member(id));
CREATE POLICY "Users can create companies" ON public.companies FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners can update companies" ON public.companies FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.company_memberships WHERE company_id = id AND user_id = auth.uid() AND role = 'owner')
);

-- RLS for memberships
CREATE POLICY "Members can view memberships" ON public.company_memberships FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "Users can insert memberships" ON public.company_memberships FOR INSERT WITH CHECK (user_id = auth.uid());

-- Suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  nif TEXT NOT NULL,
  legal_name TEXT,
  address TEXT,
  email TEXT,
  phone TEXT,
  confidence_score NUMERIC(3,2) DEFAULT 0,
  cached_data JSONB,
  cached_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view suppliers" ON public.suppliers FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "Members can insert suppliers" ON public.suppliers FOR INSERT WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "Members can update suppliers" ON public.suppliers FOR UPDATE USING (public.is_company_member(company_id));

-- Invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  supplier_name TEXT NOT NULL DEFAULT '',
  supplier_nif TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12,2),
  issue_date DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'missing' CHECK (status IN ('missing', 'contacted', 'received', 'closed')),
  last_contact_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view invoices" ON public.invoices FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "Members can insert invoices" ON public.invoices FOR INSERT WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "Members can update invoices" ON public.invoices FOR UPDATE USING (public.is_company_member(company_id));
CREATE POLICY "Members can delete invoices" ON public.invoices FOR DELETE USING (public.is_company_member(company_id));

-- Message templates table
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'formal' CHECK (tone IN ('formal', 'friendly')),
  day_trigger INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view templates" ON public.message_templates FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "Members can insert templates" ON public.message_templates FOR INSERT WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "Members can update templates" ON public.message_templates FOR UPDATE USING (public.is_company_member(company_id));
CREATE POLICY "Members can delete templates" ON public.message_templates FOR DELETE USING (public.is_company_member(company_id));

-- Outreach logs table
CREATE TABLE public.outreach_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'whatsapp')),
  recipient TEXT,
  subject TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'replied')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.outreach_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view outreach" ON public.outreach_logs FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "Members can insert outreach" ON public.outreach_logs FOR INSERT WITH CHECK (public.is_company_member(company_id));

-- Attachments table
CREATE TABLE public.attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view attachments" ON public.attachments FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "Members can insert attachments" ON public.attachments FOR INSERT WITH CHECK (public.is_company_member(company_id));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_message_templates_updated_at BEFORE UPDATE ON public.message_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for invoice files
INSERT INTO storage.buckets (id, name, public) VALUES ('invoice-files', 'invoice-files', false);

CREATE POLICY "Members can view invoice files" ON storage.objects FOR SELECT USING (
  bucket_id = 'invoice-files' AND auth.uid() IS NOT NULL
);
CREATE POLICY "Members can upload invoice files" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'invoice-files' AND auth.uid() IS NOT NULL
);
