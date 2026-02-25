
-- Table to store shareable links with password protection
CREATE TABLE public.shared_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  password_hash text NOT NULL,
  label text DEFAULT 'Contabilidade',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone
);

ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view shared links"
ON public.shared_links FOR SELECT
USING (is_company_member(company_id));

CREATE POLICY "Members can insert shared links"
ON public.shared_links FOR INSERT
WITH CHECK (is_company_member(company_id));

CREATE POLICY "Members can update shared links"
ON public.shared_links FOR UPDATE
USING (is_company_member(company_id));

CREATE POLICY "Members can delete shared links"
ON public.shared_links FOR DELETE
USING (is_company_member(company_id));

-- Extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;
