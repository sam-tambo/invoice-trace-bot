

# WhatsApp Outreach via Twilio

## Overview
Add WhatsApp messaging as an outreach channel alongside the existing email system. Uses a single shared Twilio number. Includes a webhook to receive supplier replies and route them to the correct company/invoice.

## Prerequisites -- Secrets Needed
Two new secrets must be configured before this works:
- **TWILIO_ACCOUNT_SID** -- your Twilio Account SID
- **TWILIO_AUTH_TOKEN** -- your Twilio Auth Token
- **TWILIO_WHATSAPP_NUMBER** -- the Twilio WhatsApp-enabled number (e.g. `whatsapp:+14155238886`)

## Changes

### 1. New Edge Function: `send-bulk-whatsapp`
File: `supabase/functions/send-bulk-whatsapp/index.ts`

Mirrors the existing `send-bulk-email` logic but sends via Twilio WhatsApp API:
- Authenticates user, verifies company membership
- Fetches invoices with status "missing" (optionally filtered by invoice_ids)
- For each invoice, checks if supplier has a **phone** number
- Sends WhatsApp message via Twilio REST API (`POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json`) with `From: whatsapp:+...` and `To: whatsapp:+{supplier_phone}`
- Uses message template (same template system, text only -- WhatsApp doesn't support subject)
- Updates invoice status to "contacted", logs to `outreach_logs` with `channel: "whatsapp"`, and saves to `inbox_messages`

### 2. New Edge Function: `receive-whatsapp`
File: `supabase/functions/receive-whatsapp/index.ts`

Webhook endpoint for Twilio to POST incoming WhatsApp messages:
- Receives Twilio webhook payload (form-encoded: `From`, `Body`, `NumMedia`, `MediaUrl0`, etc.)
- Extracts phone number from `From` field (strips `whatsapp:` prefix)
- Looks up supplier by phone number in `suppliers` table to find the `company_id` and `supplier_nif`
- If media attachments exist (NumMedia > 0), downloads them and uploads to `invoice-files` storage bucket
- Optionally runs AI parsing on PDF/image attachments (same logic as `receive-email`)
- Tries to match to an existing invoice (status missing/contacted for that supplier)
- Stores message in `inbox_messages` with `direction: "inbound"` and `from_email` set to the WhatsApp number
- Returns TwiML `<Response/>` (empty, no auto-reply needed)

Config in `supabase/config.toml`:
```toml
[functions.send-bulk-whatsapp]
verify_jwt = false

[functions.receive-whatsapp]
verify_jwt = false
```

### 3. UI: Add WhatsApp button to Invoices page
In `src/pages/Invoices.tsx`:
- Add a "WhatsApp em Massa" button next to the existing "Pedir Faturas" email button
- Shows count of suppliers with phone numbers (similar to email count)

### 4. New Component: `BulkWhatsAppDialog`
File: `src/components/BulkWhatsAppDialog.tsx`

Similar to `BulkEmailDialog` but:
- Shows count of missing invoices and count with phone numbers
- Calls `send-bulk-whatsapp` edge function
- Displays results (sent/skipped)

### 5. Inbox Integration
No schema changes needed -- `inbox_messages` already has all required fields. WhatsApp messages will appear in the inbox alongside emails, distinguished by the phone number in `from_email`/`to_email` fields.

## Technical Details

### Twilio WhatsApp API call (in edge function):
```text
POST https://api.twilio.com/2010-04-01/Accounts/{ACCOUNT_SID}/Messages.json
Authorization: Basic base64(ACCOUNT_SID:AUTH_TOKEN)
Content-Type: application/x-www-form-urlencoded

From=whatsapp:+14155238886&To=whatsapp:+351912345678&Body=...
```

### Twilio Webhook Setup (manual step for user)
After deployment, the user needs to configure the Twilio webhook URL in their Twilio console:
- Go to Twilio Console > Messaging > WhatsApp Sandbox (or production sender)
- Set "When a message comes in" URL to: `https://uxttxsscvirkgvnltvfd.supabase.co/functions/v1/receive-whatsapp`
- Method: POST

### Phone number format
Supplier phone numbers in the `suppliers` table should be in E.164 format (e.g. `+351912345678`). The edge function will normalize by stripping spaces/dashes before sending.

