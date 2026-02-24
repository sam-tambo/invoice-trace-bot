

# Fix Multi-Tenancy Security in Bulk Email

## Problem

The `send-bulk-email` edge function has a security gap: it accepts a `company_id` from the request body but does not verify that the authenticated user is a member of that company. Any logged-in user could potentially trigger bulk emails for another company.

## Changes

### 1. Fix `send-bulk-email` edge function

Replace the `getClaims` auth check with `getUser()`, then verify company membership before proceeding:

```text
Current flow:
  1. Check JWT exists
  2. getClaims (may not work)
  3. Trust company_id from body
  4. Send emails

Fixed flow:
  1. Check JWT exists
  2. getUser() to get user ID
  3. Query company_memberships to verify user belongs to company_id
  4. Only then send emails
```

Specific changes in `supabase/functions/send-bulk-email/index.ts`:
- Replace `getClaims()` with `getUser()` to reliably get the user's ID
- Add a membership check: query `company_memberships` table to confirm `user_id + company_id` match exists
- Return 403 Forbidden if user is not a member of the requested company

### 2. No other changes needed

The rest of the system is already properly isolated:
- **RLS policies** on `inbox_messages` use `is_company_member(company_id)` -- users can only read/update their own company's messages
- **Inbox page** filters by `selectedCompany.id` and RLS enforces it server-side
- **Realtime subscription** is filtered by `company_id`
- **`receive-email` webhook** resolves `company_id` from the supplier lookup, not from user input
- **`outreach_logs`** and **`invoices`** tables also have RLS scoped by `is_company_member`

