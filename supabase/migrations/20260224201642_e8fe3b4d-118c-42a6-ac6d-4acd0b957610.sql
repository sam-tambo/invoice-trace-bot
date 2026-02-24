
-- Create email_connections table for storing OAuth tokens
CREATE TABLE public.email_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'gmail',
  email_address TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, provider)
);

-- Enable RLS
ALTER TABLE public.email_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members can view connections"
  ON public.email_connections FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Users can insert own connections"
  ON public.email_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_company_member(company_id));

CREATE POLICY "Members can update connections"
  ON public.email_connections FOR UPDATE
  USING (is_company_member(company_id));

CREATE POLICY "Members can delete connections"
  ON public.email_connections FOR DELETE
  USING (is_company_member(company_id));

-- Trigger for updated_at
CREATE TRIGGER update_email_connections_updated_at
  BEFORE UPDATE ON public.email_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
