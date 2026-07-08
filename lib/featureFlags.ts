// Bill split is a single-user beta feature (see supabase/functions/_shared/billSplitAuth.ts
// for the server-side enforcement — this client check only controls UI visibility).
const BILL_SPLIT_ALLOWED_EMAIL = 'sabya1986@yahoo.com'

export function canUseBillSplit(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === BILL_SPLIT_ALLOWED_EMAIL
}
