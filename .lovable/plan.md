

# Gmail Integration -- Auto-find and Link Missing Invoices

## Overview
Allow users to connect their Gmail account via Google OAuth. The system will then search their inbox for emails from suppliers with missing invoices, download PDF/image attachments, parse them with AI, and automatically link them to the correct missing invoice record.

## How It Works (User Flow)
1. In Settings, click "Ligar Gmail"
2. Google login screen appears -- user grants read-only email access
3. Back in the app, Gmail shows as connected
4. On the Invoices page, click "Procurar no Gmail" 
5. The system searches the user's inbox for emails from suppliers who have missing invoices, downloads attachments, parses them, and updates matched invoices to "received"

## Prerequisites -- Secrets Needed
- **GOOGLE_CLIENT_ID** -- from Google Cloud Console OAuth credentials
- **GOOGLE_CLIENT_SECRET** -- from Google Cloud Console OAuth credentials

The user must create a Google Cloud project with Gmail API enabled and configure OAuth consent screen with the `gmail.readonly` scope.

## Changes

### 1. New Database Table: `email_connections`
Stores OAuth refresh tokens per company so the system can access Gmail on behalf of the user.

Columns:
- `id` (uuid, PK)
- `company_id` (uuid, NOT NULL) -- which company this connection belongs to
- `user_id` (uuid, NOT NULL) -- which user authorized it
- `provider` (text, default `'gmail'`) -- for future extensibility (Outlook, etc.)
- `email_address` (text) -- the connected email address
- `access_token` (text) -- short-lived token
- `refresh_token` (text) -- long-lived token for refreshing
- `token_expires_at` (timestamptz) -- when access_token expires
- `created_at`, `updated_at` (timestamptz)

RLS: company members can SELECT; only the authorizing user can INSERT; members can UPDATE (for token refresh); members can DELETE (disconnect).

### 2. New Edge Function: `gmail-auth-callback`
Handles the OAuth callback from Google:
- Receives the authorization `code` from the frontend redirect
- Exchanges it for access_token + refresh_token via Google's token endpoint
- Fetches the user's email address from Gmail profile
- Stores tokens in `email_connections` table
- Returns success with the connected email address

### 3. New Edge Function: `scan-gmail-invoices`
The core logic -- searches Gmail and matches invoices:
- Authenticates user, verifies company membership
- Loads all missing/contacted invoices for the company
- Gets the Gmail connection tokens (refreshes if expired)
- For each supplier with missing invoices, builds a Gmail search query: `from:{supplier_email} has:attachment (filename:pdf OR filename:jpg OR filename:png)`
- Also searches by supplier name or NIF if no email is known
- Downloads PDF/image attachments from matching emails
- Sends attachments to AI (same Claude parsing logic as `receive-email`) to extract invoice data
- Matches parsed invoice numbers/amounts against missing invoices
- Updates matched invoices to "received" status and saves attachments
- Returns a summary of what was found and matched

### 4. UI: Settings Page -- Connect Gmail Section
Add a new card to Settings with:
- "Ligar Gmail" button (starts OAuth flow)
- When connected: shows the connected email address and a "Desligar" button
- Status indicator (connected/not connected)

The OAuth flow:
- Frontend opens a popup/redirect to Google's OAuth URL with `gmail.readonly` scope
- Redirect URI points to the app (e.g., `/settings?gmail_callback=true`)
- Frontend captures the `code` parameter and sends it to `gmail-auth-callback` edge function

### 5. UI: Invoices Page -- Scan Gmail Button
Add a "Procurar no Gmail" button next to existing action buttons:
- Only visible when Gmail is connected
- Shows a progress dialog while scanning
- Displays results: X emails found, Y invoices matched, Z attachments downloaded

### 6. Config Updates
```text
supabase/config.toml additions:

[functions.gmail-auth-callback]
verify_jwt = false

[functions.scan-gmail-invoices]
verify_jwt = false
```

## Technical Details

### Google OAuth Flow
```text
1. Frontend builds URL:
   https://accounts.google.com/o/oauth2/v2/auth
   ?client_id={GOOGLE_CLIENT_ID}
   &redirect_uri={APP_URL}/settings
   &response_type=code
   &scope=https://www.googleapis.com/auth/gmail.readonly
   &access_type=offline
   &prompt=consent

2. User authorizes, Google redirects back with ?code=...

3. Frontend sends code to gmail-auth-callback edge function

4. Edge function exchanges code for tokens:
   POST https://oauth2.googleapis.com/token
   client_id, client_secret, code, redirect_uri, grant_type=authorization_code
```

### Gmail API Search (in scan function)
```text
GET https://gmail.googleapis.com/gmail/v1/users/me/messages
  ?q=from:supplier@example.com has:attachment filename:pdf

GET https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}
  ?format=full  (to get attachment metadata)

GET https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}/attachments/{attachmentId}
  (to download attachment data as base64)
```

### Token Refresh (automatic)
When access_token expires, the edge function uses the refresh_token:
```text
POST https://oauth2.googleapis.com/token
  client_id, client_secret, refresh_token, grant_type=refresh_token
```

### File Summary
- **New files**: `supabase/functions/gmail-auth-callback/index.ts`, `supabase/functions/scan-gmail-invoices/index.ts`, `src/components/GmailConnectionCard.tsx`, `src/components/ScanGmailDialog.tsx`
- **Modified files**: `src/pages/Settings.tsx` (add Gmail card), `src/pages/Invoices.tsx` (add scan button)
- **New migration**: create `email_connections` table with RLS

