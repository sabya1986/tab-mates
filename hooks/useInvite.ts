import { useState } from 'react'
import { supabase } from '../lib/supabase'

const APP_SCHEME = 'tabmates'
const WEB_BASE = 'https://tab-mates.vercel.app'

export function inviteUrl(token: string) {
  // Universal link for web; deep link for the app
  return `${WEB_BASE}/join?token=${token}`
}

export function useInvite() {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generateInvite(tripId: string): Promise<string | null> {
    setLoading(true)
    setError(null)

    // Reuse a non-expired invite if one exists
    const { data: existing } = await supabase
      .from('trip_invites')
      .select('token, expires_at')
      .eq('trip_id', tripId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      setToken(existing.token)
      setLoading(false)
      return existing.token
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setLoading(false); return null }

    const { data, error: insertError } = await supabase
      .from('trip_invites')
      .insert({ trip_id: tripId, created_by: user.id })
      .select('token')
      .single()

    setLoading(false)
    if (insertError || !data) {
      setError('Could not generate invite link')
      return null
    }

    setToken(data.token)
    return data.token
  }

  return { token, loading, error, generateInvite, inviteUrl }
}

export async function acceptInvite(token: string): Promise<{
  success: boolean
  tripId?: string
  error?: string
}> {
  const { data: invite, error: inviteError } = await supabase
    .from('trip_invites')
    .select('trip_id, expires_at')
    .eq('token', token)
    .maybeSingle()

  console.log('[acceptInvite] token:', token, 'invite:', JSON.stringify(invite), 'error:', JSON.stringify(inviteError))

  if (inviteError || !invite) {
    return { success: false, error: 'Invalid invite link' }
  }

  if (new Date(invite.expires_at) < new Date()) {
    return { success: false, error: 'This invite link has expired' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'not_authenticated' }

  // Already a member — just redirect
  const { data: existing } = await supabase
    .from('trip_members')
    .select('user_id')
    .eq('trip_id', invite.trip_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return { success: true, tripId: invite.trip_id }
  }

  const { error: joinError } = await supabase
    .from('trip_members')
    .insert({ trip_id: invite.trip_id, user_id: user.id, role: 'member' })

  if (joinError) {
    return { success: false, error: 'Could not join trip' }
  }

  return { success: true, tripId: invite.trip_id }
}
