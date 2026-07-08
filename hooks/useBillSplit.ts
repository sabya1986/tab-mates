import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export type DraftLine = {
  phone_number: string
  line_type: 'voice' | 'data' | 'wearable'
  amount: number
  person_name: string | null
  email: string | null
  matched: boolean
}

export type AccountCharge = { description: string; amount: number }

export type BillDraft = {
  billing_period: string
  bill_total: number
  lines: DraftLine[]
  account_charges: AccountCharge[]
  notes: string[]
}

export type SplitRow = {
  name: string
  email: string
  linesDesc: string
  lineSubtotal: number
  accountShare: number
  total: number
}

export type ComputeResult = {
  billSplitId: string
  rows: SplitRow[]
  grandTotal: number
  accountTotal: number
  billTotal: number | null
  reconciled: boolean | null
  mismatchCents: number | null
}

export type SendResult = { email: string; sent: boolean; error?: string }[]

type BillSplitStore = {
  draft: BillDraft | null
  computed: ComputeResult | null
  parsing: boolean
  computing: boolean
  sending: boolean
  error: string | null

  parseBill: (pdfBase64: string) => Promise<boolean>
  computeBill: (finalized: {
    billing_period: string
    bill_total: number
    people: { name: string; email: string; lines: { number: string; type: DraftLine['line_type']; amount: number }[] }[]
    account_charges: AccountCharge[]
  }) => Promise<boolean>
  sendEmails: () => Promise<SendResult | null>
  reset: () => void
}

export const useBillSplitStore = create<BillSplitStore>((set, get) => ({
  draft: null,
  computed: null,
  parsing: false,
  computing: false,
  sending: false,
  error: null,

  parseBill: async (pdfBase64) => {
    set({ parsing: true, error: null })
    const { data, error } = await supabase.functions.invoke('bill-split-parse', {
      body: { pdfBase64 },
    })
    set({ parsing: false })
    if (error || !data) {
      set({ error: error?.message ?? 'Could not read that bill.' })
      return false
    }
    set({ draft: data as BillDraft })
    return true
  },

  computeBill: async (finalized) => {
    set({ computing: true, error: null })
    const { data, error } = await supabase.functions.invoke('bill-split-compute', {
      body: finalized,
    })
    set({ computing: false })
    if (error || !data) {
      set({ error: error?.message ?? 'Could not compute the split.' })
      return false
    }
    set({ computed: data as ComputeResult })
    return true
  },

  sendEmails: async () => {
    const billSplitId = get().computed?.billSplitId
    if (!billSplitId) return null
    set({ sending: true, error: null })
    const { data, error } = await supabase.functions.invoke('bill-split-send', {
      body: { billSplitId },
    })
    set({ sending: false })
    if (error || !data) {
      set({ error: error?.message ?? 'Could not send emails.' })
      return null
    }
    return (data.results as SendResult) ?? []
  },

  reset: () => set({ draft: null, computed: null, error: null }),
}))
