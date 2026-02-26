

## Understanding Your Workflow

You're absolutely right. The NIF.pt API is a **one-time enrichment step**, not something that runs continuously. The correct flow is:

```text
Accountant imports missing invoices (PDF)
        ↓
System finds unknown NIFs → calls NIF.pt API once per supplier
        ↓
Contact data (email, phone, address) cached in suppliers table
        ↓
From here on, everything uses cached data — no more API calls
        ↓
Outreach (email/SMS), tracking, follow-ups all use local data
```

## What This Enables (Using Cached Data, No Further API Calls)

### 1. Auto-Enrich on Import (one-time per NIF)
When invoices are imported from the PDF, automatically trigger NIF lookup for any supplier NIF not yet in the database. This already partially works via the "Procurar Fornecedores" button — the change is making it **automatic** right after import, so the user never has to click it manually.

### 2. Contact Status Indicators on Invoice List
Add visual dots next to each invoice row:
- **Green** = supplier has email, ready for automated outreach
- **Yellow** = supplier has phone only, manual or SMS outreach
- **Red** = no contact found, needs manual intervention

This uses data already in the `suppliers` table — zero API calls.

### 3. One-Click Outreach from Invoice Detail
When viewing an invoice whose supplier has a cached email, show a "Send Request" button that composes and sends an email using your existing templates and Resend integration. No API call needed — email is already stored.

### 4. Enriched Supplier Cards
In the invoice detail dialog and Fornecedores page, display the full company profile (legal name, address, CAE, legal nature, share capital) already cached from the initial lookup.

### 5. Bulk Enrichment for Existing Data
A button on the Suppliers page: "Enrich All" — looks up every supplier that has `lookup_success = false` or `last_lookup_at IS NULL`. Run once, then never again for those NIFs.

## Implementation Plan

### Step 1: Auto-enrich after PDF import
Modify `ImportInvoices.tsx` — after `handleImport` inserts invoices, automatically call `nif-lookup` for each unique NIF that doesn't already have a supplier record. Remove the need to manually click "Procurar Fornecedores".

### Step 2: Contact status dots on Invoices page
Join invoices with suppliers data to show green/yellow/red indicators. Query suppliers once on page load and create a NIF→contact map. Pure frontend change using existing cached data.

### Step 3: Supplier detail card in InvoiceContactDialog
When opening an invoice detail, fetch the linked supplier record and display a rich card with all cached NIF.pt data (address, CAE, legal nature, contact details).

### Step 4: Bulk enrich button on Suppliers page
Add an "Enriquecer Todos" button that finds suppliers with `lookup_success = false` and calls `nif-lookup` for each. Progress bar showing completion.

### Technical Details

**Files to modify:**
- `src/pages/ImportInvoices.tsx` — add auto-enrichment after import
- `src/pages/Invoices.tsx` — add contact status dots (green/yellow/red)
- `src/components/InvoiceContactDialog.tsx` — add supplier detail card
- `src/pages/Suppliers.tsx` — add bulk enrich button, show more cached fields
- `src/components/SupplierCard.tsx` (new) — reusable supplier detail component

**No new edge functions needed.** The existing `nif-lookup` function handles everything. Once data is cached, all features read from the `suppliers` table directly.

**No database changes needed.** The suppliers table already has all required columns.

