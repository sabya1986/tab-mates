import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type ActivityItem = {
  key: string
  type: 'expense' | 'payment' | 'joined'
  date: string
  tripId: string
  tripName: string
  currency: string
  // expense
  description?: string
  amount?: number
  paidByName?: string
  isPaidByMe?: boolean
  // payment
  fromName?: string
  toName?: string
  isFromMe?: boolean
  // joined
  userName?: string
  isMe?: boolean
}

export type ActivitySection = {
  title: string
  data: ActivityItem[]
}

function sectionTitle(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return 'This week'
  if (diffDays < 30) return 'This month'
  return 'Earlier'
}

export function timeAgo(dateStr: string): string {
  const d = new Date(dateStr)
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function groupIntoSections(items: ActivityItem[]): ActivitySection[] {
  const sectionMap = new Map<string, ActivityItem[]>()
  const order = ['Today', 'Yesterday', 'This week', 'This month', 'Earlier']

  for (const item of items) {
    const title = sectionTitle(item.date)
    if (!sectionMap.has(title)) sectionMap.set(title, [])
    sectionMap.get(title)!.push(item)
  }

  return order
    .filter((t) => sectionMap.has(t))
    .map((title) => ({ title, data: sectionMap.get(title)! }))
}

export function useActivity(currentUserId: string) {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!currentUserId) return
    setLoading(true)

    const [expResult, payResult, memberResult] = await Promise.all([
      supabase
        .from('expenses')
        .select(`
          id, description, amount, created_at,
          trips!inner(id, name, currency),
          payer:users!paid_by(id, name)
        `)
        .order('created_at', { ascending: false })
        .limit(60),

      supabase
        .from('payments')
        .select(`
          id, amount, created_at,
          trips!inner(id, name, currency),
          from_profile:users!from_user(id, name),
          to_profile:users!to_user(id, name)
        `)
        .order('created_at', { ascending: false })
        .limit(60),

      supabase
        .from('trip_members')
        .select(`
          joined_at, user_id,
          trips!inner(id, name, currency),
          member:users!user_id(id, name)
        `)
        .order('joined_at', { ascending: false })
        .limit(60),
    ])

    const merged: ActivityItem[] = []

    for (const e of expResult.data ?? []) {
      const trip = e.trips as any
      const payer = e.payer as any
      merged.push({
        key: `expense-${e.id}`,
        type: 'expense',
        date: e.created_at,
        tripId: trip.id,
        tripName: trip.name,
        currency: trip.currency,
        description: e.description,
        amount: Number(e.amount),
        paidByName: payer?.name ?? 'Someone',
        isPaidByMe: payer?.id === currentUserId,
      })
    }

    for (const p of payResult.data ?? []) {
      const trip = p.trips as any
      const from = p.from_profile as any
      const to = p.to_profile as any
      merged.push({
        key: `payment-${p.id}`,
        type: 'payment',
        date: p.created_at,
        tripId: trip.id,
        tripName: trip.name,
        currency: trip.currency,
        amount: Number(p.amount),
        fromName: from?.name ?? 'Someone',
        toName: to?.name ?? 'Someone',
        isFromMe: from?.id === currentUserId,
      })
    }

    for (const m of memberResult.data ?? []) {
      const trip = m.trips as any
      const user = m.member as any
      merged.push({
        key: `joined-${m.user_id}-${trip.id}`,
        type: 'joined',
        date: m.joined_at,
        tripId: trip.id,
        tripName: trip.name,
        currency: trip.currency,
        userName: user?.name ?? 'Someone',
        isMe: m.user_id === currentUserId,
      })
    }

    merged.sort((a, b) => b.date.localeCompare(a.date))
    setItems(merged)
    setLoading(false)
  }, [currentUserId])

  return { items, loading, refresh }
}
