import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// Bill split is a single-user beta feature. Everyone else gets a 403 even if
// they're a normal authenticated Tab Mates user.
const ALLOWED_EMAIL = 'sabya1986@yahoo.com'

export async function requireBillSplitUser(req: Request): Promise<
  | { ok: true; supabase: SupabaseClient; userId: string }
  | { ok: false; response: Response }
> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return { ok: false, response: new Response('Missing Authorization header', { status: 401 }) }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return { ok: false, response: new Response('Not authenticated', { status: 401 }) }
  }

  if (user.email?.toLowerCase() !== ALLOWED_EMAIL) {
    return { ok: false, response: new Response('Bill split is not enabled for this account', { status: 403 }) }
  }

  return { ok: true, supabase, userId: user.id }
}
