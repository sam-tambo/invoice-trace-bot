

## Full Backend Export for Migration to Pendentes (Supabase)

Since this project runs on Lovable Cloud, I cannot disconnect it or swap backends. However, here is a **complete export** of everything you need to replicate the backend in your standalone Supabase project "Pendentes."

There are 3 things to set up: **Database Schema**, **Edge Functions**, and **Secrets**.

---

### 1. SECRETS TO CONFIGURE

In your Pendentes Supabase Dashboard → Edge Functions → Secrets, add these:

| Secret Name | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `RESEND_API_KEY` | Your Resend.com API key |
| `RESEND_FROM_EMAIL` | The verified sender email in Resend |
| `NIF_PT_API_KEY` | `c2568f0d50eb7ffa60d88f348ca4ad55` |
| `NYLAS_API_KEY` | Your Nylas API key |
| `NYLAS_CLIENT_ID` | Your Nylas client ID |
| `NYLAS_CALLBACK_URI` | The callback URL pointing to your new `gmail-auth-callback` function |
| `GOOGLE_CLIENT_ID` | Your Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth client secret |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are automatically available in Supabase Edge Functions.

---

### 2. DATABASE SCHEMA (Single Combined Migration)

Run this as a single SQL migration in your Pendentes project (SQL Editor → New Query):

```sql
-- ============================================================
-- INVOICETRACE FULL SCHEMA — Run in Pendentes Supabase project
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Companies
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  nif TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Company memberships
CREATE TABLE public.company_memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);
ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION public.is_company_member(p_company_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE company_id = p_company_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Companies RLS
CREATE POLICY "Users can view their companies" ON public.companies FOR SELECT TO authenticated USING (is_company_member(id) OR auth.uid() = created_by);
CREATE POLICY "Users can create companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owners can update companies" ON public.companies FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM company_memberships WHERE company_memberships.company_id = companies.id AND company_memberships.user_id = auth.uid() AND company_memberships.role = 'owner'));

-- Memberships RLS
CREATE POLICY "Members can view memberships" ON public.company_memberships FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Users can create memberships" ON public.company_memberships FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Suppliers
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  nif TEXT NOT NULL,
  legal_name TEXT,
  alias TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  region TEXT,
  county TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  fax TEXT,
  status TEXT,
  cae TEXT,
  legal_nature TEXT,
  share_capital NUMERIC(14,2),
  share_capital_currency TEXT DEFAULT 'EUR',
  activity_description TEXT,
  nif_pt_url TEXT,
  last_lookup_at TIMESTAMPTZ,
  lookup_success BOOLEAN DEFAULT FALSE,
  confidence_score NUMERIC DEFAULT 0,
  cached_data JSONB,
  cached_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view suppliers" ON public.suppliers FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id));
CREATE POLICY "Members can update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (is_company_member(company_id));

-- Invoices
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  supplier_name TEXT NOT NULL DEFAULT '',
  supplier_nif TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12,2),
  net_amount NUMERIC,
  vat_amount NUMERIC,
  issue_date DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'missing' CHECK (status IN ('missing', 'contacted', 'received', 'closed')),
  source TEXT DEFAULT 'manual',
  raw_image_url TEXT,
  extraction_confidence TEXT,
  extraction_notes TEXT,
  last_contact_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view invoices" ON public.invoices FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id));
CREATE POLICY "Members can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can delete invoices" ON public.invoices FOR DELETE TO authenticated USING (is_company_member(company_id));

-- Message templates
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
CREATE POLICY "Members can view templates" ON public.message_templates FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can insert templates" ON public.message_templates FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id));
CREATE POLICY "Members can update templates" ON public.message_templates FOR UPDATE TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can delete templates" ON public.message_templates FOR DELETE TO authenticated USING (is_company_member(company_id));

-- Outreach logs
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
CREATE POLICY "Members can view outreach" ON public.outreach_logs FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can insert outreach" ON public.outreach_logs FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id));

-- Attachments
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
CREATE POLICY "Members can view attachments" ON public.attachments FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can insert attachments" ON public.attachments FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id));

-- Email connections
CREATE TABLE public.email_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'gmail',
  email_address TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, provider)
);
ALTER TABLE public.email_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view connections" ON public.email_connections FOR SELECT USING (is_company_member(company_id));
CREATE POLICY "Users can insert own connections" ON public.email_connections FOR INSERT WITH CHECK (auth.uid() = user_id AND is_company_member(company_id));
CREATE POLICY "Members can update connections" ON public.email_connections FOR UPDATE USING (is_company_member(company_id));
CREATE POLICY "Members can delete connections" ON public.email_connections FOR DELETE USING (is_company_member(company_id));

-- Shared links
CREATE TABLE public.shared_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  password_hash TEXT NOT NULL,
  label TEXT DEFAULT 'Contabilidade',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);
ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view shared links" ON public.shared_links FOR SELECT USING (is_company_member(company_id));
CREATE POLICY "Members can insert shared links" ON public.shared_links FOR INSERT WITH CHECK (is_company_member(company_id));
CREATE POLICY "Members can update shared links" ON public.shared_links FOR UPDATE USING (is_company_member(company_id));
CREATE POLICY "Members can delete shared links" ON public.shared_links FOR DELETE USING (is_company_member(company_id));

-- Inbox messages
CREATE TABLE public.inbox_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  invoice_id UUID REFERENCES invoices(id),
  supplier_nif TEXT,
  direction TEXT NOT NULL DEFAULT 'inbound',
  from_email TEXT,
  to_email TEXT,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  has_attachments BOOLEAN DEFAULT false,
  attachments_parsed BOOLEAN DEFAULT false,
  matched_invoice_id UUID REFERENCES invoices(id),
  status TEXT NOT NULL DEFAULT 'new',
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view inbox" ON public.inbox_messages FOR SELECT USING (is_company_member(company_id));
CREATE POLICY "Service role can insert inbox" ON public.inbox_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Members can update inbox" ON public.inbox_messages FOR UPDATE USING (is_company_member(company_id));

-- Realtime for inbox
ALTER PUBLICATION supabase_realtime ADD TABLE public.inbox_messages;

-- Functions
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
CREATE TRIGGER update_email_connections_updated_at BEFORE UPDATE ON public.email_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Shared link functions (pgcrypto)
CREATE OR REPLACE FUNCTION public.create_shared_link(
  p_company_id uuid, p_created_by uuid, p_password text, p_label text DEFAULT 'Contabilidade'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.shared_links (company_id, created_by, password_hash, label)
  VALUES (p_company_id, p_created_by, extensions.crypt(p_password, extensions.gen_salt('bf')), p_label)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.verify_shared_link_password(
  p_link_id uuid, p_password text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_hash text;
BEGIN
  SELECT password_hash INTO v_hash FROM public.shared_links WHERE id = p_link_id;
  IF v_hash IS NULL THEN RETURN false; END IF;
  RETURN v_hash = extensions.crypt(p_password, v_hash);
END; $$;

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('invoice-files', 'invoice-files', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('invoice-scans', 'invoice-scans', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload invoice files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'invoice-files' AND auth.role() = 'authenticated');
CREATE POLICY "Public can view invoice files" ON storage.objects FOR SELECT USING (bucket_id = 'invoice-files');
CREATE POLICY "Authenticated users can delete invoice files" ON storage.objects FOR DELETE USING (bucket_id = 'invoice-files' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can upload scans" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'invoice-scans' AND auth.role() = 'authenticated');
CREATE POLICY "Anyone can view scans" ON storage.objects FOR SELECT USING (bucket_id = 'invoice-scans');
```

---

### 3. EDGE FUNCTIONS (9 functions)

Deploy these via Supabase CLI (`supabase functions deploy <name>`). Each lives in `supabase/functions/<name>/index.ts`.

**config.toml** — All functions should have `verify_jwt = false` (auth is handled in code):

```toml
[functions.parse-efatura-pdf]
verify_jwt = false

[functions.nif-lookup]
verify_jwt = false

[functions.send-bulk-email]
verify_jwt = false

[functions.receive-email]
verify_jwt = false

[functions.gmail-auth-callback]
verify_jwt = false

[functions.scan-gmail-invoices]
verify_jwt = false

[functions.nylas-webhook]
verify_jwt = false

[functions.shared-invoices]
verify_jwt = false

[functions.invoice-extract-image]
verify_jwt = false
```

The 9 edge function files are already in your codebase under `supabase/functions/`. You can deploy them directly using the Supabase CLI:

```bash
supabase functions deploy parse-efatura-pdf
supabase functions deploy nif-lookup
supabase functions deploy send-bulk-email
supabase functions deploy receive-email
supabase functions deploy gmail-auth-callback
supabase functions deploy scan-gmail-invoices
supabase functions deploy nylas-webhook
supabase functions deploy shared-invoices
supabase functions deploy invoice-extract-image
```

---

### 4. FRONTEND — Update Environment Variables

After setting up Pendentes, update your `.env` to point to the new project:

```
VITE_SUPABASE_URL=https://<your-pendentes-project-id>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-pendentes-anon-key>
VITE_SUPABASE_PROJECT_ID=<your-pendentes-project-id>
```

---

### 5. IMPORTANT NOTES

- The `LOVABLE_API_KEY` is a Lovable Cloud-only secret. In your standalone Supabase project, the `invoice-extract-image`, `receive-email`, and `nylas-webhook` functions use it as a fallback AI provider. You'll need to either remove those Lovable AI calls or rely on the Anthropic/OpenAI fallbacks.
- The `gmail-auth-callback` function has `APP_URL` hardcoded to `https://invoice-trace-bot.lovable.app` — update this to your new domain.
- The `NYLAS_CALLBACK_URI` secret must point to your new Pendentes edge function URL: `https://<pendentes-id>.supabase.co/functions/v1/gmail-auth-callback`

