

## Analysis

The uploaded file provides Claude's blueprint for two features: (1) a mobile camera scanner that sends invoice photos to Claude Vision for extraction, and (2) automatic email invoice extraction via the existing Nylas webhook. Both feed into a calendar view.

**Existing state:**
- The `invoices` table already exists with most needed columns (`invoice_number`, `supplier_name`, `supplier_nif`, `amount`, `net_amount`, `vat_amount`, `issue_date`, `due_date`, `status`, `company_id`)
- Missing columns from Claude's approach: `source` (scan/email/manual), `raw_image_url`, `extraction_confidence`, `extraction_notes`
- The `nylas-webhook` edge function already exists and handles email invoice extraction — it just needs minor enhancements
- `ANTHROPIC_API_KEY` is already configured as a secret
- `invoice-files` storage bucket already exists

## Plan

### 1. Database Migration — Add missing columns to `invoices`

Add these columns to the existing `invoices` table:
- `source TEXT DEFAULT 'manual'` — tracks origin (scan, email, manual, import)
- `raw_image_url TEXT` — stores the scanned image URL
- `extraction_confidence TEXT` — high/medium/low
- `extraction_notes TEXT` — AI notes on uncertain fields

No new table needed — we extend the existing one.

### 2. Storage Bucket — Create `invoice-scans`

Create a public bucket for storing scanned invoice images (separate from `invoice-files` which holds recovered attachments).

### 3. Edge Function — `invoice-extract-image`

New function following Claude's approach:
- Receives `{ image_base64, media_type, company_id }` from the frontend
- Authenticates the user via JWT
- Sends the image to Anthropic Claude Vision API with the Portuguese invoice extraction prompt
- Parses the structured JSON response (supplier_name, NIF, invoice_number, dates, amounts, VAT)
- Uploads the original image to `invoice-scans` bucket
- Inserts a new row into `invoices` with `source: 'scan'`, confidence level, and extracted fields
- Returns the created invoice for the confirmation screen

### 4. React Hook — `useInvoiceScanner`

Adapted from Claude's blueprint:
- `fileInputRef` for the hidden `<input type="file" capture="environment">`
- `openCamera()` triggers the file input
- `handleFileCapture(file)` converts to base64, calls the edge function, stores the result
- `reset()` clears state for another scan
- Uses the existing `company_id` from `useCompany`

### 5. New Page — Scan (`/scan`)

Camera scan page with:
- Hidden file input with `capture="environment"` for mobile rear camera
- Large tap target "Digitalizar Fatura" button with camera icon
- Processing spinner while Claude analyzes
- Confidence banner (high=green, medium=yellow, low=red)
- Extracted fields displayed in a read-only confirmation card
- Original image preview
- "Guardar" and "Digitalizar outra" action buttons
- Adapted to use shadcn/ui components (Card, Button, Badge) for consistency

### 6. New Page — Calendar (`/calendar`)

Monthly calendar view adapted from Claude's blueprint:
- Month navigation (prev/next) with invoice count
- 7-column grid showing days with colored status dots
- Click a day to open a side panel with that day's invoices
- Each invoice card shows: source icon (📷/📧/✏️), supplier name, NIF, invoice number, total, VAT, status badge
- Legend bar showing status colors
- Fetches invoices filtered by `issue_date` within the current month and `company_id`
- Uses shadcn/ui Card, Badge, Button for consistency with the rest of the app

### 7. Navigation Update

Add two new items to `AppLayout.tsx` nav:
- `{ href: "/scan", label: "Digitalizar", icon: Camera }`
- `{ href: "/calendar", label: "Calendário", icon: CalendarDays }`

### 8. Routing Update

Add to `App.tsx`:
- `<Route path="/scan" element={<ProtectedRoute><ScanInvoice /></ProtectedRoute>} />`
- `<Route path="/calendar" element={<ProtectedRoute><InvoiceCalendar /></ProtectedRoute>} />`

### 9. Nylas Webhook Enhancement

The existing `nylas-webhook/index.ts` already handles email extraction well. Minor enhancement:
- Set `source: 'email'` on matched invoices when updating status to 'received'
- For unmatched invoice attachments that are valid invoices, create a new invoice row with `source: 'email'` so they appear in the calendar even without a pre-existing record

### Technical Details

**Files to create:**
- `supabase/functions/invoice-extract-image/index.ts` — Claude Vision extraction edge function
- `src/hooks/useInvoiceScanner.ts` — camera scan React hook
- `src/pages/ScanInvoice.tsx` — scan page
- `src/pages/InvoiceCalendar.tsx` — calendar page

**Files to modify:**
- `src/App.tsx` — add routes
- `src/components/AppLayout.tsx` — add nav items
- `supabase/functions/nylas-webhook/index.ts` — set source field, create unmatched invoices
- `supabase/config.toml` — add invoice-extract-image function config

**Database migration:**
- ALTER TABLE invoices ADD COLUMN source, raw_image_url, extraction_confidence, extraction_notes
- CREATE storage bucket invoice-scans

**Secrets already available:** ANTHROPIC_API_KEY, NYLAS_API_KEY, SUPABASE_SERVICE_ROLE_KEY — no new secrets needed.

