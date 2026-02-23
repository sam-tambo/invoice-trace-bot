

# Redesign Import Page: PDF Parsing, Agent Actions, and Invoice Upload

## What We're Building

The import page will be completely redesigned to handle the **TOConline "Mapa de conferencia e-Fatura" PDF format**, display imported invoices in a rich table with supplier match status, and provide agent actions for bulk and individual invoice recovery.

---

## 1. PDF Parsing Edge Function

Create a backend function (`parse-efatura-pdf`) that:
- Accepts a PDF file upload
- Uses an AI model (Lovable AI - Gemini 2.5 Flash) to extract the table data from the PDF
- Returns structured rows with: NIF, Date, Invoice Number (Doc. Compra), Net Amount, VAT, Total, Status
- Handles the multi-page TOConline format (repeated headers, page footers)

The PDF columns map as follows:
| PDF Column | Database Field |
|---|---|
| Numero do documento do fornecedor | `supplier_nif` |
| Data | `issue_date` |
| Doc. Compra | `invoice_number` |
| Valor liquido | stored as metadata |
| IVA | stored as metadata |
| Total do documento e-fatura | `amount` |

## 2. Redesigned Import Page (`/import`)

Replace the current CSV-only import with a new flow:

**Step 1 - Upload**: Accept PDF (`.pdf`) or CSV files. Show drag-and-drop area.

**Step 2 - Review Table**: After parsing, display all extracted invoices in a table matching the PDF layout:
- NIF | Fornecedor | Doc. Compra | Data | Valor Liquido | IVA | Total | Fornecedor Encontrado?
- The "Fornecedor Encontrado?" column shows a green check if the NIF already exists in the `suppliers` table with an email, or a red X if not
- Checkboxes for selecting individual rows
- "Select All" checkbox in the header

**Step 3 - Actions**:
- **"Importar Selecionadas"** button to save selected invoices to the database
- **"Procurar Fornecedores em Massa"** (Bulk Agent) button: triggers NIF lookups for all unmatched suppliers via Firecrawl
- **"Procurar"** button per row: triggers individual NIF lookup

## 3. Agent: Find Invoices (Bulk and Individual)

Create an edge function (`nif-lookup`) that:
- Takes a NIF and uses Firecrawl to search `racius.com` + Google for the company
- Extracts: legal name, address, email, phone
- Stores/updates the `suppliers` table with found data and confidence score
- Returns the result to the frontend

**Requires**: Firecrawl connector to be set up (we'll prompt the user to connect it).

## 4. Invoice Upload and Email Matching

Add two ways to submit received invoices:

**A. Upload Invoice File**: 
- Button per invoice row to upload a PDF/image of the received invoice
- Stores in the `invoice-files` storage bucket (already exists)
- Creates an `attachments` record
- Updates invoice status to "received"

**B. Email-to-Agent** (forward invoice by email):
- Create an edge function (`receive-invoice-email`) that accepts inbound emails (via Resend webhook)
- Parses the email for invoice references (NIF, invoice number)
- Matches against existing missing invoices
- Stores the attachment and marks the invoice as received
- This requires Resend integration (will be set up in a follow-up step)

## 5. Database Changes

Add columns to the `invoices` table for the additional PDF data:
- `net_amount` (numeric, nullable) - Valor liquido
- `vat_amount` (numeric, nullable) - IVA

## Technical Details

### Files to Create:
1. `supabase/functions/parse-efatura-pdf/index.ts` - PDF parsing via Lovable AI
2. `supabase/functions/nif-lookup/index.ts` - Supplier lookup via Firecrawl
3. `src/pages/ImportInvoices.tsx` - Complete rewrite with new flow

### Files to Modify:
1. Database migration - add `net_amount`, `vat_amount` to `invoices`

### Dependencies:
- Firecrawl connector needed for NIF lookups (will prompt user)
- Resend connector needed for email agent (future step)

### Edge Function Flow:

```text
PDF Upload --> parse-efatura-pdf (AI extraction) --> Structured JSON
                                                        |
                                                        v
                                               Review Table in UI
                                                        |
                                        +---------------+---------------+
                                        |                               |
                                   Import to DB                  NIF Lookup
                                        |                    (Firecrawl/Racius)
                                        v                               |
                                  invoices table                        v
                                        |                       suppliers table
                                        v
                              Upload received invoice
                                        |
                                        v
                              invoice-files bucket + attachments table
                              + status -> "received"
```

### RLS Note:
All existing RLS policies remain. The new columns are part of the existing `invoices` table which already has proper policies. The edge functions will use the service role key for internal operations.

