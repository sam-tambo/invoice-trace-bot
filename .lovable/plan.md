

## Plan: Update Landing Page — Showcase All Features & Mark as Free

The landing page already has a solid structure. The changes needed are:

### 1. Add a prominent "100% Gratuito" (Free) badge and messaging
- Add a "Gratuito para sempre" badge in the hero section
- Update CTA buttons to emphasize "free" (already says "Começar Gratuitamente" but needs stronger emphasis)
- Add a dedicated pricing/free section before the final CTA that clearly states the tool is completely free

### 2. Expand the features section to cover ALL app capabilities
Current features listed: Photo capture, Smart organization, Gmail integration, Auto-contact, TOConline sync, Accountant portal.

**Add missing features:**
- **Inbox / Email Reception** — Receive supplier replies directly in-app
- **Calendar View** — Visual calendar of invoices by due date
- **Multiple Mailboxes** — Connect multiple Gmail accounts
- **Bulk Email** — Send invoice requests to multiple suppliers at once
- **Invoice Scanning (OCR)** — AI-powered data extraction from photos/PDFs
- **e-Fatura Import** — Direct PDF import from Portugal's tax portal
- **Shared Links** — Password-protected sharing with accountants
- **NIF Lookup** — Automatic supplier data enrichment from NIF

Reorganize into a grid of ~10-12 features for comprehensive coverage.

### 3. Add a "Pricing" section
- Simple centered section stating "100% Gratuito" with a list of what's included (unlimited invoices, unlimited suppliers, all integrations, etc.)
- No pricing tiers — just one clear "Free" message

### 4. Update navigation
- Add "Preços" link in the nav bar pointing to the pricing section

### 5. Files to modify
- `src/pages/Landing.tsx` — All changes are in this single file

