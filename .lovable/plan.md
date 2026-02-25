

## Diagnosis: Two Critical Bugs + Search Strategy Issues

### Bug 1: `Maximum call stack size exceeded` (THE CRASH)

**Line 191**: `btoa(String.fromCharCode(...fileBuffer))` — the spread operator `...fileBuffer` passes every byte as a separate argument to `String.fromCharCode`. For a 1MB PDF, that's ~1,000,000 arguments on the call stack. JavaScript's call stack limit is typically ~10,000-30,000. This crashes the function every time it tries to process an attachment.

**Fix**: Use a chunked base64 encoding approach that processes bytes in batches of 8192.

### Bug 2: `402 Not enough credits` for AI parsing

The Lovable AI gateway returns 402 when credits are exhausted. The function logs this but keeps trying subsequent attachments, wasting time. More importantly, the function should have a **fallback matching strategy** that doesn't require AI at all — matching by invoice number in the email subject/body or filename.

### Bug 3: Search queries are too restrictive

Current queries combine `from:email` + `{invoice_numbers}` + `fatura OR invoice...` into one query. This means ALL conditions must match. If the supplier sends from a different email address, or uses different terminology, nothing is found.

**Better strategy**: Run multiple search passes with decreasing specificity:
1. **Pass 1**: Search by exact invoice number (highest confidence)
2. **Pass 2**: Search by supplier email + broad invoice terms (medium confidence)
3. **Pass 3**: Search by supplier name + invoice terms (lower confidence)

### Implementation Plan

**File: `supabase/functions/scan-gmail-invoices/index.ts`**

1. **Fix base64 encoding** — Replace the spread-based `btoa` with a chunked approach:
```text
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    const chunk = bytes.subarray(i, i + 8192);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
```

2. **Add non-AI matching as primary strategy** — Before downloading/parsing attachments with AI, check if the email subject, body snippet, or attachment filename contains an invoice number. This is fast, free, and catches most cases.

3. **Restructure search into multiple passes**:
   - Pass 1: For each invoice number, search `"invoice_number"` directly (exact match, highest confidence)
   - Pass 2: For each supplier with email, search `from:supplier@email.com has:attachment` (medium confidence)
   - Pass 3: For suppliers without email, search by supplier name + `fatura` (lower confidence)
   - Deduplicate results across passes

4. **Add confidence field to results** — Each match gets a confidence level: `exact_number`, `ai_parsed`, `amount_match`, `likely` so the user knows which matches to review.

5. **Gracefully handle AI credit exhaustion** — When a 402 is received, stop calling AI for the rest of the run and rely on non-AI matching only. Log a warning that gets surfaced to the user.

6. **Cap attachment size** — Skip attachments larger than 5MB to avoid memory issues and slow processing.

### Technical Details

The `String.fromCharCode(...array)` pattern is a well-known JavaScript pitfall. The spread operator converts the array into individual function arguments, each consuming a stack frame. The fix chunks the array into groups of 8192 bytes (safely under any stack limit) and concatenates the results.

The multi-pass search strategy follows how a human would search: first look for the exact invoice number, then broaden to the supplier, then broaden further. This dramatically improves recall while maintaining precision through confidence scoring.

The non-AI matching layer (checking subject/body/filename for invoice numbers) will catch the majority of cases where suppliers email invoices with the invoice number visible in the email, avoiding both the AI cost and the credit exhaustion issue entirely.

