
-- Create a public bucket for invoice files
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-files', 'invoice-files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files to the invoice-files bucket
CREATE POLICY "Authenticated users can upload invoice files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'invoice-files' AND auth.role() = 'authenticated');

-- Allow public read access to invoice files
CREATE POLICY "Public can view invoice files"
ON storage.objects FOR SELECT
USING (bucket_id = 'invoice-files');

-- Allow authenticated users to delete their uploaded files
CREATE POLICY "Authenticated users can delete invoice files"
ON storage.objects FOR DELETE
USING (bucket_id = 'invoice-files' AND auth.role() = 'authenticated');
