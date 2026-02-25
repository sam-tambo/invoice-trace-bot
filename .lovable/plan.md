

## Plan: Make Email Connection Generic (Support Gmail, Outlook, and Others via Nylas)

The current implementation is hardcoded to "Gmail" everywhere -- in the UI component name, labels, provider filter queries, and the edge function's `provider` parameter set to `"google"`. Since Nylas supports multiple providers (Google, Microsoft/Outlook, Yahoo, IMAP), this needs to be generalized.

### Changes Required

**1. Rename and update `GmailConnectionCard.tsx` → `EmailConnectionCard.tsx`**
- Rename component from `GmailConnectionCard` to `EmailConnectionCard`
- Change title from "Gmail" to "Caixa de Correio" (Mailbox)
- Change description to mention Gmail, Outlook, and other providers
- Change button text from "Ligar Gmail" to "Ligar Email"
- Update toast messages to be generic ("Email ligado" instead of "Gmail ligado")
- Remove the `.eq("provider", "gmail")` filter -- query any email connection for the company
- Show the provider name dynamically based on what's stored (e.g., "Gmail", "Outlook")
- Update the disconnect button label accordingly

**2. Update `supabase/functions/gmail-auth-callback/index.ts`**
- Remove the hardcoded `authUrl.searchParams.set("provider", "google")` on line 64 -- this forces the Google provider. Without it, Nylas shows its own provider picker UI where users can choose Gmail, Outlook, Yahoo, etc.
- When saving to DB, store the actual provider from `tokenData.provider` instead of hardcoding `"gmail"`

**3. Update `supabase/functions/scan-gmail-invoices/index.ts`**
- Remove the `.eq("provider", "gmail")` filter on line 93 -- scan whichever email provider is connected

**4. Update `src/pages/Invoices.tsx`**
- Change the `checkGmailConnection` function to not filter by `provider: "gmail"` -- check for any active email connection
- Rename `hasGmail` state to `hasEmail` and update references
- Update button labels from "Procurar no Gmail" to "Procurar no Email"

**5. Update `src/pages/Settings.tsx`**
- Update the import from `GmailConnectionCard` to `EmailConnectionCard`

**6. Update `src/components/ScanGmailDialog.tsx`**
- Update dialog title/labels from Gmail-specific to generic email terminology

### Technical Details

- The key Nylas change is removing `provider: "google"` from the auth URL. Per Nylas docs, omitting the `provider` parameter shows the Nylas hosted provider picker, letting users choose their email provider.
- The `provider` value returned by Nylas in the token exchange (`tokenData.provider`) will be stored in the DB, enabling the UI to show which provider is connected (e.g., "Google", "Microsoft", "Yahoo").
- The Nylas message search API (`search_query_native`) works across all providers, so `scan-gmail-invoices` needs no API-level changes beyond removing the provider filter.
- A provider label map will be added to the UI: `{ google: "Gmail", microsoft: "Outlook", yahoo: "Yahoo Mail", imap: "Email" }`.

