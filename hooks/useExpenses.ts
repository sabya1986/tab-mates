import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Expense, ExpenseSplit } from '../lib/types'

export type ExpenseWithSplits = Expense & { splits: ExpenseSplit[] }

type ExpensesStore = {
  expenses: ExpenseWithSplits[]
  loading: boolean
  fetchExpenses: (tripId: string) => Promise<void>
  addExpense: (params: AddExpenseParams) => Promise<boolean>
  updateExpense: (params: UpdateExpenseParams) => Promise<boolean>
  deleteExpense: (expenseId: string, tripId: string) => Promise<void>
}

type UpdateExpenseParams = AddExpenseParams & { expenseId: string }

type AddExpenseParams = {
  tripId: string
  description: string
  amount: number
  paidBy: string
  splitMethod: 'equal' | 'exact' | 'percentage' | 'shares'
  splits: { userId: string; amount: number }[]
  category?: string
  expenseDate?: string
}

export const useExpensesStore = create<ExpensesStore>((set) => ({
  expenses: [],
  loading: false,

  fetchExpenses: async (tripId) => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('expenses')
      .select('*, expense_splits(*)')
      .eq('trip_id', tripId)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (!error && data) {
      set({
        expenses: data.map((e: any) => ({ ...e, splits: e.expense_splits ?? [] })),
      })
    }
    set({ loading: false })
  },

  addExpense: async ({ tripId, description, amount, paidBy, splitMethod, splits, category, expenseDate }) => {
    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .insert({
        trip_id: tripId,
        paid_by: paidBy,
        description,
        amount,
        split_method: splitMethod,
        category: category ?? null,
        expense_date: expenseDate ?? new Date().toISOString().split('T')[0],
      })
      .select()
      .single()

    if (expenseError || !expense) return false

    const { error: splitsError } = await supabase
      .from('expense_splits')
      .insert(splits.map((s) => ({
        expense_id: expense.id,
        user_id: s.userId,
        amount: s.amount,
      })))

    if (splitsError) return false

    const full: ExpenseWithSplits = { ...expense, splits: splits.map((s) => ({
      id: '',
      expense_id: expense.id,
      user_id: s.userId,
      amount: s.amount,
      is_settled: false,
    }))}

    set((state) => ({ expenses: [full, ...state.expenses] }))
    return true
  },

  updateExpense: async ({ expenseId, description, amount, paidBy, splitMethod, splits, expenseDate }) => {
    const { error: updateError } = await supabase
      .from('expenses')
      .update({
        description,
        amount,
        paid_by: paidBy,
        split_method: splitMethod,
        expense_date: expenseDate ?? new Date().toISOString().split('T')[0],
      })
      .eq('id', expenseId)

    if (updateError) return false

    await supabase.from('expense_splits').delete().eq('expense_id', expenseId)

    const { error: splitsError } = await supabase
      .from('expense_splits')
      .insert(splits.map((s) => ({
        expense_id: expenseId,
        user_id: s.userId,
        amount: s.amount,
      })))

    if (splitsError) return false

    set((state) => ({
      expenses: state.expenses.map((e) =>
        e.id === expenseId
          ? {
              ...e,
              description,
              amount,
              paid_by: paidBy,
              split_method: splitMethod,
              splits: splits.map((s) => ({
                id: '',
                expense_id: expenseId,
                user_id: s.userId,
                amount: s.amount,
                is_settled: false,
              })),
            }
          : e
      ),
    }))
    return true
  },

  deleteExpense: async (expenseId, tripId) => {
    await supabase.from('expenses').delete().eq('id', expenseId)
    set((state) => ({
      expenses: state.expenses.filter((e) => e.id !== expenseId),
    }))
  },
}))
