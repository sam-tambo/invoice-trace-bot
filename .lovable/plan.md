

## Thorough Diagnosis: Three Critical Bugs Found

### Bug 1: Missing `code_verifier: "nylas"` in token exchange (PRIMARY CAUSE)

The Nylas documentation for API key authentication **explicitly requires** `"code_verifier": "nylas"` in the POST to `/v3/connect/token`. The current edge function does NOT send this field. From the docs:

```text
POST /v3/connect/token
{
  "client_id": "<NYLAS_CLIENT_ID>",
  "client_secret": "<NYLAS_API_KEY>",
  "grant_type": "authorization_code",
  "code": "<CODE>",
  "redirect_uri": "<CALLBACK_URI>",
  "code_verifier": "nylas"        <-- MISSING from our code
}
```

Without this, Nylas rejects the code exchange, returning "Given 'code' not valid or expired". The code IS reaching the function (confirmed via curl), but the Nylas API rejects it.

**File:** `supabase/functions/gmail-auth-callback/index.ts` line 64-70 -- add `code_verifier: "nylas"` to the body.

### Bug 2: `scan-gmail-invoices` uses non-existent `getClaims()` method

Line 70 of `scan-gmail-invoices/index.ts` calls `supabase.auth.getClaims(token)` which does not exist in this environment. This means even if Gmail connects, scanning will immediately fail with an auth error. Must be replaced with `supabase.auth.getUser()`.

### Bug 3: `scan-gmail-invoices` has incomplete CORS headers

Line 7 of `scan-gmail-invoices/index.ts` only allows `authorization, x-client-info, apikey, content-type` -- missing the `x-supabase-client-platform*` headers. Same CORS bug that was already fixed in `gmail-auth-callback`.

### Implementation Steps

1. **`supabase/functions/gmail-auth-callback/index.ts`**: Add `code_verifier: "nylas"` to the token exchange body (1 line change)

2. **`supabase/functions/scan-gmail-invoices/index.ts`**: 
   - Fix CORS headers to include all supabase client headers
   - Replace `getClaims(token)` with `getUser()` and adjust the user ID extraction

3. **Deploy both functions** and test the POST exchange with curl to verify it works

4. **Test end-to-end** on the published app

### Technical Details

The `code_verifier` field is part of PKCE (Proof Key for Code Exchange). Nylas uses a static value `"nylas"` as the verifier for their hosted OAuth flow with API key authentication. Without it, Nylas cannot verify the code exchange request is legitimate and rejects it outright. This single missing field is why every connection attempt has failed silently -- the code reaches the function, Nylas rejects the exchange, the error is returned but potentially swallowed by the frontend error handling.

