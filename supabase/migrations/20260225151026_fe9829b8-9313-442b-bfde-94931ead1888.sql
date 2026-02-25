
-- Add missing columns to invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS raw_image_url TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS extraction_confidence TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS extraction_notes TEXT;

-- Create invoice-scans storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('invoice-scans', 'invoice-scans', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for invoice-scans bucket
CREATE POLICY "Authenticated users can upload scans"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'invoice-scans' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view scans"
ON storage.objects FOR SELECT
USING (bucket_id = 'invoice-scans');
