

## Diagnosis: Why Gmail Connection Keeps Failing Silently

### Root Cause Found

I checked the edge function logs and found **zero POST requests** to `gmail-auth-callback` -- only GETs (fetching the client ID). The code exchange POST is never reaching the function.

**Primary Issue: Incomplete CORS headers** in `gmail-auth-callback/index.ts`.

The function currently allows:
```
authorization, x-client-info, apikey, content-type
```

But `supabase.functions.invoke()` sends additional headers that the browser's CORS preflight check rejects:
```
x-supabase-client-platform, x-supabase-client-platform-version, 
x-supabase-client-runtime, x-supabase-client-runtime-version
```

When the preflight OPTIONS request fails, the browser silently blocks the POST. The code is captured from the URL, but the exchange call never reaches the server. No error is shown because the CORS failure happens at browser level before the fetch completes.

**Secondary Issue: Redirect URI mismatch risk.** If the user initiates from the preview domain but Nylas redirects to a different domain, the `redirect_uri` sent during code exchange won't match the one used during the initial auth request, causing Nylas to reject it.

### Fixes Required

**1. Fix CORS headers in `gmail-auth-callback/index.ts`**

Update the `corsHeaders` to include all headers sent by the Supabase JS client:

```javascript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
```

**2. Add better error handling in `GmailConnectionCard.tsx`**

The `handleCallback` function catches errors but a CORS failure might not produce a meaningful message. Add explicit logging and handle network-level failures:

```typescript
const { data, error } = await supabase.functions.invoke("gmail-auth-callback", {
  body: { code, redirect_uri: redirectUri, company_id: selectedCompany.id },
});
console.log("Gmail callback response:", { data, error });
```

**3. Fix redirect URI consistency**

Store the exact `redirect_uri` used during `connectGmail` in `sessionStorage` alongside the code, so that `handleCallback` uses the exact same URI for the exchange -- regardless of which domain the redirect lands on.

**4. Redeploy and test**

After fixing, deploy the edge function and test the full flow end-to-end by calling the function directly to verify it responds to POST requests.

### Implementation Steps
1. Fix CORS headers in `gmail-auth-callback/index.ts`
2. Update `GmailConnectionCard.tsx` to persist and reuse the exact redirect_uri
3. Add better error logging in the callback handler
4. Deploy and test the edge function with a direct POST call

