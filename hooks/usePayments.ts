import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Payment } from '../lib/types'

type PaymentsStore = {
  payments: Payment[]
  loading: boolean
  fetchPayments: (tripId: string) => Promise<void>
  recordPayment: (params: {
    tripId: string
    toUserId: string
    amount: number
    note?: string
    paymentDate?: string
  }) => Promise<boolean>
}

export const usePaymentsStore = create<PaymentsStore>((set) => ({
  payments: [],
  loading: false,

  fetchPayments: async (tripId) => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('trip_id', tripId)
      .order('payment_date', { ascending: false })

    if (!error && data) set({ payments: data })
    set({ loading: false })
  },

  recordPayment: async ({ tripId, toUserId, amount, note, paymentDate }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { data, error } = await supabase
      .from('payments')
      .insert({
        trip_id: tripId,
        from_user: user.id,
        to_user: toUserId,
        amount,
        note: note ?? null,
        payment_date: paymentDate ?? new Date().toISOString().split('T')[0],
      })
      .select()
      .single()

    if (error || !data) return false

    set((state) => ({ payments: [data, ...state.payments] }))
    return true
  },
}))
