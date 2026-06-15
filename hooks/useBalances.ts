import { useMemo } from 'react'
import type { ExpenseWithSplits } from './useExpenses'
import type { Payment, User } from '../lib/types'

export type Balance = {
  fromUserId: string
  toUserId: string
  amount: number
}

export type MemberBalance = {
  userId: string
  net: number // positive = is owed money, negative = owes money
}

// Given expenses + payments, compute who owes whom (simplified)
export function useBalances(
  expenses: ExpenseWithSplits[],
  payments: Payment[],
  members: User[],
  currentUserId: string
) {
  return useMemo(() => {
    // Build raw balance map: balances[debtor][creditor] = amount
    const raw: Record<string, Record<string, number>> = {}

    function add(debtor: string, creditor: string, amount: number) {
      if (debtor === creditor) return
      if (!raw[debtor]) raw[debtor] = {}
      raw[debtor][creditor] = (raw[debtor][creditor] ?? 0) + amount
    }

    // From expenses: non-payers owe the payer their split amount
    for (const expense of expenses) {
      for (const split of expense.splits) {
        if (split.user_id !== expense.paid_by) {
          add(split.user_id, expense.paid_by, split.amount)
        }
      }
    }

    // Subtract payments: from_user paid to_user, reducing what from_user owes
    for (const payment of payments) {
      add(payment.to_user, payment.from_user, payment.amount)
    }

    // Net out mutual debts: if A owes B $10 and B owes A $3, A owes B $7
    const netted: Balance[] = []
    const seen = new Set<string>()

    for (const debtor of Object.keys(raw)) {
      for (const creditor of Object.keys(raw[debtor] ?? {})) {
        const key = [debtor, creditor].sort().join('|')
        if (seen.has(key)) continue
        seen.add(key)

        const ab = raw[debtor]?.[creditor] ?? 0
        const ba = raw[creditor]?.[debtor] ?? 0
        const net = ab - ba

        if (net > 0.005) {
          netted.push({ fromUserId: debtor, toUserId: creditor, amount: Math.round(net * 100) / 100 })
        } else if (net < -0.005) {
          netted.push({ fromUserId: creditor, toUserId: debtor, amount: Math.round(-net * 100) / 100 })
        }
      }
    }

    // Per-member net balance
    const memberBalances: MemberBalance[] = members.map((m) => {
      const owedToMe = netted
        .filter((b) => b.toUserId === m.id)
        .reduce((sum, b) => sum + b.amount, 0)
      const iOwe = netted
        .filter((b) => b.fromUserId === m.id)
        .reduce((sum, b) => sum + b.amount, 0)
      return { userId: m.id, net: Math.round((owedToMe - iOwe) * 100) / 100 }
    })

    const myBalances = netted.filter(
      (b) => b.fromUserId === currentUserId || b.toUserId === currentUserId
    )

    const myNet = memberBalances.find((m) => m.userId === currentUserId)?.net ?? 0

    return { balances: netted, myBalances, memberBalances, myNet }
  }, [expenses, payments, members, currentUserId])
}
