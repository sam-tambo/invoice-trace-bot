
-- Add net_amount and vat_amount columns to invoices table
ALTER TABLE public.invoices ADD COLUMN net_amount numeric NULL;
ALTER TABLE public.invoices ADD COLUMN vat_amount numeric NULL;
