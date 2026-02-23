
# InvoiceTrace — Portuguese Accounting Invoice Recovery App

## Overview
A full-featured app in Portuguese that helps business owners track down missing invoices, auto-contact suppliers, and follow up until every invoice is recovered. Clean, CRM-style dashboard with blue/green accents.

---

## 1. Authentication & Multi-Company Support
- Email/password login via Supabase Auth
- User profile with ability to manage multiple companies under one account
- Company switcher in the sidebar/header
- All data scoped to the selected company

## 2. Onboarding Flow
- Quick 3-step wizard: Upload invoice list → Review/confirm suppliers → Customize message templates → Launch
- Progress indicator showing completion
- Under 2 minutes to get started

## 3. Invoice Import
- **CSV/Excel upload** with column mapping (NIF, invoice number, supplier name, amount, date range)
- **Manual paste/entry** form as alternative
- Validation and duplicate detection
- Imported invoices default to "Missing" status

## 4. Smart Company Lookup
- For each NIF, use a Supabase edge function to search **Racius.com** and **Google** to find supplier details
- Extract: legal name, NIF, registered address, contact email, phone number
- Display a confidence score per match
- Allow users to manually edit/override any found details
- Cache results to avoid repeated lookups

## 5. Invoice Tracking Dashboard
- **Table view** with columns: Supplier, NIF, Invoice Ref, Amount, Days Outstanding, Last Contact, Status
- **Color-coded rows**: Red (no contact), Yellow (contacted/awaiting), Green (received)
- **Status badges**: Missing → Contacted → Received → Closed
- **Filters** by status, supplier, date range
- **Click any row** to expand full contact history and timeline
- **Progress bar** showing "X of Y invoices recovered" — turns green when complete

## 6. Message Templates & Outreach
- Pre-written Portuguese email templates for Day 0, Day 3, and Day 7
- **Tone toggle**: Formal / Friendly
- User can edit templates before sending
- Templates include dynamic placeholders (supplier name, invoice ref, amount, etc.)

## 7. Automated Outreach Engine (via Supabase Edge Functions)
- **Day 0**: Send polite email via **Resend** requesting the missing invoice
- **Day 3**: Follow-up email + SMS via **Twilio** (or WhatsApp if available)
- **Day 7**: Final notice email, flag for manual follow-up in dashboard
- Scheduled via Supabase cron jobs (pg_cron)
- All outreach logged with timestamps in contact history

## 8. Invoice Receipt & Matching
- Manual option: mark invoice as received + upload PDF/image
- File storage via Supabase Storage
- Full history of received documents per invoice
- **Export**: One-click ZIP download of all recovered invoices, or forward to accountant's email

## 9. Reporting & Notifications
- Weekly summary email to the accountant showing recovery rate
- Dashboard stats: total missing, contacted, recovered, recovery rate %
- 🎉 Confetti animation when all invoices are marked as received

## 10. Design & UX
- **Language**: Entire UI in Portuguese
- **Style**: Clean, minimal, professional — white base with blue (#2563EB) and green (#16A34A) accents
- Cards with subtle shadows, no clutter
- Mobile-responsive for on-the-go use
- CRM-like dashboard feel — warm but businesslike

---

## Technical Architecture
- **Frontend**: React + TypeScript + Tailwind + shadcn/ui
- **Backend**: Supabase (Auth, Database, Edge Functions, Storage)
- **Email**: Resend (via edge function)
- **SMS**: Twilio (via edge function)
- **Company Lookup**: Firecrawl or direct scraping of Racius.com via edge function
- **Scheduling**: pg_cron for automated follow-ups
