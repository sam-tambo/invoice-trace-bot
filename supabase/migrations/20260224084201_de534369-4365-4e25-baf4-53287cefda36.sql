
CREATE TABLE public.inbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  invoice_id uuid REFERENCES invoices(id),
  supplier_nif text,
  direction text NOT NULL DEFAULT 'inbound',
  from_email text,
  to_email text,
  subject text,
  body_text text,
  body_html text,
  has_attachments boolean DEFAULT false,
  attachments_parsed boolean DEFAULT false,
  matched_invoice_id uuid REFERENCES invoices(id),
  status text NOT NULL DEFAULT 'new',
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view inbox" ON public.inbox_messages
  FOR SELECT USING (is_company_member(company_id));

CREATE POLICY "Service role can insert inbox" ON public.inbox_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Members can update inbox" ON public.inbox_messages
  FOR UPDATE USING (is_company_member(company_id));

-- Enable realtime for inbox
ALTER PUBLICATION supabase_realtime ADD TABLE public.inbox_messages;
