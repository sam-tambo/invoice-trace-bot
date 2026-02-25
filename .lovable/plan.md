

## Problem Analysis

Two issues to address:

### Issue 1: Matched invoice has no file attached
The MEO invoice (FT A/856709073) was found via text matching (Pass 1 — invoice number in email subject/body) and its status was updated to "received", but **no file was uploaded**. Looking at lines 316-363 of the edge function:

- The code finds a text match, then checks for PDF/image attachments on the email
- If the attachment download succeeds, it uploads to storage and inserts an `attachments` row
- But if there are no qualifying attachments (e.g. the email only contains the invoice number in text, with no PDF attached), it falls through to the "email_match" path (line 355-363), which marks it "received" with `filename: "email_match"` and **no file upload**
- Additionally, the storage bucket `invoice-files` is set to `public: false`, but the `getPublicUrl` function in `InvoiceContactDialog` expects public access — so even when files ARE uploaded, the URLs won't work

### Issue 2: AI credits exhausted (Lovable AI)
The logs show `402 Not enough credits` immediately on the first AI call. The user wants to switch to their own **Anthropic (Claude) API** and **OpenAI API** keys, which are already configured as secrets (`ANTHROPIC_API_KEY`). An `OPENAI_API_KEY` would need to be added if not present.

---

## Plan

### 1. Fix storage bucket — make it public
The bucket was created as `public: false` in the initial migration but a later migration tried to set it to `public: true`. The bucket is currently private. Run a migration to update it:
```sql
UPDATE storage.buckets SET public = true WHERE id = 'invoice-files';
```

### 2. Fix the "email_match" path — always download the attachment
When the text match finds the invoice number but the attachment download is skipped or fails, the code still marks it as "received" with no file. Change this logic:

- When a text match is found and there are attachments on the email, **always attempt to download and upload the first PDF/image attachment**, even if the invoice number wasn't found in the filename
- Only fall through to "email_match" (no file) if there are truly **zero** PDF/image attachments on the email
- After uploading, generate and store the public URL in the `attachments` table (already done via `file_path`)

### 3. Switch AI parsing from Lovable AI to Claude/OpenAI
Replace the Lovable AI gateway call (lines 388-404) with a direct Anthropic Claude API call using the existing `ANTHROPIC_API_KEY` secret:

- Use Claude's vision API (`claude-sonnet-4-20250514`) to parse invoice PDFs/images
- The API endpoint is `https://api.anthropic.com/v1/messages`
- Format: send the base64 image as a `image` content block with the same extraction prompt
- Fall back to OpenAI if Claude fails (would need `OPENAI_API_KEY` secret)
- Remove the `LOVABLE_API_KEY` dependency for this function entirely

### 4. Add logging for match results
Add `console.log` when a match is found, including whether a file was uploaded or not, so debugging is easier.

### Technical Details

**Claude API call format** (replacing lines 388-404):
```typescript
const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "x-api-key": anthropicApiKey,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: att.content_type, data: b64Data } },
        { type: "text", text: "..." },
      ],
    }],
  }),
});
```

**Storage bucket fix**: Simple SQL migration to flip `public` to `true`.

**Files to modify**:
- `supabase/functions/scan-gmail-invoices/index.ts` — fix attachment download logic, switch AI to Claude API
- Database migration — make `invoice-files` bucket public

