import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import { useExpensesStore } from '../../../hooks/useExpenses'
import { useAuthStore } from '../../../hooks/useAuth'
import { alert } from '../../../lib/alert'
import { useTheme, type Colors } from '../../../lib/theme'
import type { User } from '../../../lib/types'

type SplitMethod = 'equal' | 'exact' | 'percentage'

export default function NewExpenseScreen() {
  const { tripId, currency, expenseId } = useLocalSearchParams<{
    tripId: string; currency: string; expenseId?: string
  }>()
  const { session } = useAuthStore()
  const { expenses, addExpense, updateExpense, deleteExpense } = useExpensesStore()
  const C = useTheme()
  const styles = makeStyles(C)

  const isEditing = !!expenseId

  const [members, setMembers] = useState<User[]>([])
  const [description, setDescription] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [paidBy, setPaidBy] = useState(session?.user.id ?? '')
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal')
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadMembers()
  }, [tripId])

  useEffect(() => {
    if (!isEditing || members.length === 0) return
    const expense = expenses.find((e) => e.id === expenseId)
    if (!expense) return

    setDescription(expense.description)
    setAmountStr(String(expense.amount))
    setPaidBy(expense.paid_by)
    setSplitMethod(expense.split_method as SplitMethod)

    const splitUserIds = new Set(expense.splits.map((s) => s.user_id))
    setSelectedMembers(splitUserIds)

    if (expense.split_method !== 'equal') {
      const amounts: Record<string, string> = {}
      for (const s of expense.splits) {
        amounts[s.user_id] = String(s.amount)
      }
      setExactAmounts(amounts)
    }
  }, [isEditing, expenseId, members])

  async function loadMembers() {
    const { data } = await supabase
      .from('trip_members')
      .select('users(*)')
      .eq('trip_id', tripId)

    if (data) {
      const users: User[] = data.map((m: any) => m.users).filter(Boolean)
      setMembers(users)
      if (!isEditing) {
        setSelectedMembers(new Set(users.map((u) => u.id)))
      }
    }
  }

  const amount = parseFloat(amountStr) || 0
  const selected = members.filter((m) => selectedMembers.has(m.id))

  function computeSplits(): { userId: string; amount: number }[] | null {
    if (selected.length === 0 || amount <= 0) return null

    if (splitMethod === 'equal') {
      const share = Math.round((amount / selected.length) * 100) / 100
      const total = share * selected.length
      const diff = Math.round((amount - total) * 100) / 100
      return selected.map((m, i) => ({
        userId: m.id,
        amount: i === 0 ? share + diff : share,
      }))
    }

    if (splitMethod === 'exact') {
      const splits = selected.map((m) => ({
        userId: m.id,
        amount: parseFloat(exactAmounts[m.id] ?? '0') || 0,
      }))
      const total = splits.reduce((s, x) => s + x.amount, 0)
      if (Math.abs(total - amount) > 0.01) {
        alert('Amounts don\'t add up', `Split total (${total.toFixed(2)}) must equal ${amount.toFixed(2)}.`)
        return null
      }
      return splits
    }

    if (splitMethod === 'percentage') {
      const splits = selected.map((m) => ({
        userId: m.id,
        pct: parseFloat(exactAmounts[m.id] ?? '0') || 0,
      }))
      const totalPct = splits.reduce((s, x) => s + x.pct, 0)
      if (Math.abs(totalPct - 100) > 0.1) {
        alert('Percentages don\'t add up', `Total is ${totalPct.toFixed(1)}%, must be 100%.`)
        return null
      }
      return splits.map((s) => ({
        userId: s.userId,
        amount: Math.round((amount * s.pct) / 100 * 100) / 100,
      }))
    }

    return null
  }

  async function handleSave() {
    if (!description.trim()) { alert('', 'Add a description.'); return }
    if (amount <= 0) { alert('', 'Enter an amount.'); return }

    const splits = computeSplits()
    if (!splits) return

    setLoading(true)
    const params = {
      tripId,
      description: description.trim(),
      amount,
      paidBy,
      splitMethod,
      splits,
      expenseDate: new Date().toISOString().split('T')[0],
    }

    const success = isEditing
      ? await updateExpense({ ...params, expenseId })
      : await addExpense(params)
    setLoading(false)

    if (success) {
      router.back()
    } else {
      alert('Error', `Could not ${isEditing ? 'update' : 'save'} expense. Please try again.`)
    }
  }

  async function handleDelete() {
    if (!expenseId) return
    setDeleting(true)
    await deleteExpense(expenseId, tripId)
    setDeleting(false)
    router.back()
  }

  function toggleMember(userId: string) {
    setSelectedMembers((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const splitMethods: { key: SplitMethod; label: string }[] = [
    { key: 'equal', label: 'Equal' },
    { key: 'exact', label: 'Exact $' },
    { key: 'percentage', label: '%' },
  ]

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isEditing ? 'Edit expense' : 'Add expense'}</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={loading}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={isEditing ? 'Update expense' : 'Save expense'}
          accessibilityState={{ disabled: loading }}
        >
          {loading
            ? <ActivityIndicator size="small" color={C.brand} />
            : <Text style={styles.save}>{isEditing ? 'Update' : 'Save'}</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.amountRow}>
          <Text style={styles.currencySymbol}>{currency}</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0.00"
            placeholderTextColor={C.textMuted}
            value={amountStr}
            onChangeText={setAmountStr}
            keyboardType="decimal-pad"
            autoFocus={!isEditing}
            accessibilityLabel="Amount"
          />
        </View>

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Hotel, Dinner"
          placeholderTextColor={C.textMuted}
          value={description}
          onChangeText={setDescription}
          maxLength={80}
          returnKeyType="done"
          accessibilityLabel="Description"
        />

        <Text style={styles.label}>Paid by</Text>
        <View style={styles.memberRow}>
          {members.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.memberPill, paidBy === m.id && styles.memberPillSelected]}
              onPress={() => setPaidBy(m.id)}
              accessibilityRole="button"
              accessibilityLabel={`Paid by ${m.id === session?.user.id ? 'you' : m.name}`}
              accessibilityState={{ selected: paidBy === m.id }}
            >
              <Text style={[styles.memberPillText, paidBy === m.id && styles.memberPillTextSelected]}>
                {m.id === session?.user.id ? 'You' : m.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Split method</Text>
        <View style={styles.splitMethodRow}>
          {splitMethods.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.methodTab, splitMethod === s.key && styles.methodTabSelected]}
              onPress={() => setSplitMethod(s.key)}
              accessibilityRole="button"
              accessibilityLabel={`Split ${s.label}`}
              accessibilityState={{ selected: splitMethod === s.key }}
            >
              <Text style={[styles.methodTabText, splitMethod === s.key && styles.methodTabTextSelected]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>
          Split among ({selected.length} people
          {splitMethod === 'equal' && amount > 0
            ? ` · ${currency} ${(amount / Math.max(selected.length, 1)).toFixed(2)} each`
            : ''})
        </Text>
        {members.map((m) => {
          const isSelected = selectedMembers.has(m.id)
          return (
            <View key={m.id} style={styles.splitRow}>
              <TouchableOpacity
                style={[styles.memberCheck, isSelected && styles.memberCheckSelected]}
                onPress={() => toggleMember(m.id)}
                accessibilityRole="checkbox"
                accessibilityLabel={m.id === session?.user.id ? 'You' : m.name}
                accessibilityState={{ checked: isSelected }}
              >
                {isSelected && <Text style={styles.checkMark}>✓</Text>}
              </TouchableOpacity>
              <Text style={styles.memberName}>{m.id === session?.user.id ? 'You' : m.name}</Text>
              {isSelected && splitMethod !== 'equal' && (
                <TextInput
                  style={styles.splitAmountInput}
                  placeholder={splitMethod === 'percentage' ? '0%' : '0.00'}
                  placeholderTextColor={C.textMuted}
                  value={exactAmounts[m.id] ?? ''}
                  onChangeText={(v) => setExactAmounts((prev) => ({ ...prev, [m.id]: v }))}
                  keyboardType="decimal-pad"
                  accessibilityLabel={`Amount for ${m.id === session?.user.id ? 'you' : m.name}`}
                />
              )}
              {isSelected && splitMethod === 'equal' && amount > 0 && (
                <Text style={styles.splitAmountDisplay}>
                  {currency} {(amount / selected.length).toFixed(2)}
                </Text>
              )}
            </View>
          )
        })}

        {isEditing && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDelete}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel="Delete expense"
            accessibilityState={{ disabled: deleting }}
          >
            {deleting
              ? <ActivityIndicator size="small" color={C.danger} />
              : <Text style={styles.deleteBtnText}>Delete expense</Text>
            }
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: C.border,
    },
    cancel: { fontSize: 16, color: C.textTertiary, width: 60 },
    title: { fontSize: 17, fontWeight: '600', color: C.textPrimary },
    save: { fontSize: 16, color: C.brand, fontWeight: '600', width: 60, textAlign: 'right' },
    body: { padding: 16, gap: 4 },
    amountRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 20,
    },
    currencySymbol: { fontSize: 22, color: C.textTertiary, marginRight: 8, fontWeight: '500' },
    amountInput: { fontSize: 42, fontWeight: '600', color: C.textPrimary, minWidth: 120 },
    label: { fontSize: 12, color: C.textTertiary, fontWeight: '500', marginTop: 12, marginBottom: 6 },
    input: {
      borderWidth: 0.5, borderColor: C.border, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
      backgroundColor: C.surface, color: C.textPrimary, marginBottom: 8,
    },
    memberRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    memberPill: {
      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
      borderWidth: 0.5, borderColor: C.border, backgroundColor: C.surface,
      minHeight: 44, justifyContent: 'center',
    },
    memberPillSelected: { backgroundColor: C.brand, borderColor: C.brand },
    memberPillText: { fontSize: 14, color: C.textSecondary, fontWeight: '500' },
    memberPillTextSelected: { color: '#fff' },
    splitMethodRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
    methodTab: {
      flex: 1, paddingVertical: 10, borderRadius: 8,
      borderWidth: 0.5, borderColor: C.border, alignItems: 'center',
      backgroundColor: C.surface, minHeight: 44, justifyContent: 'center',
    },
    methodTabSelected: { backgroundColor: C.brand, borderColor: C.brand },
    methodTabText: { fontSize: 13, fontWeight: '500', color: C.textTertiary },
    methodTabTextSelected: { color: '#fff' },
    splitRow: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
      borderBottomWidth: 0.5, borderBottomColor: C.borderSubtle,
    },
    memberCheck: {
      width: 24, height: 24, borderRadius: 12, borderWidth: 1.5,
      borderColor: C.border, marginRight: 10, alignItems: 'center', justifyContent: 'center',
    },
    memberCheckSelected: { backgroundColor: C.brand, borderColor: C.brand },
    checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
    memberName: { flex: 1, fontSize: 15, color: C.textPrimary },
    splitAmountInput: {
      borderWidth: 0.5, borderColor: C.border, borderRadius: 8,
      paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, width: 80,
      textAlign: 'right', backgroundColor: C.surface, color: C.textPrimary,
    },
    splitAmountDisplay: { fontSize: 14, color: C.textSecondary, fontWeight: '500' },
    deleteBtn: {
      marginTop: 32, paddingVertical: 14, alignItems: 'center',
      borderWidth: 0.5, borderColor: C.danger, borderRadius: 12,
      backgroundColor: C.dangerSurface,
    },
    deleteBtnText: { color: C.danger, fontSize: 16, fontWeight: '600' },
  })
}
