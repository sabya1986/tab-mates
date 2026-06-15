import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert, ActivityIndicator, Switch
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import { useExpensesStore } from '../../../hooks/useExpenses'
import { useAuthStore } from '../../../hooks/useAuth'
import type { User } from '../../../lib/types'

type SplitMethod = 'equal' | 'exact' | 'percentage'

export default function NewExpenseScreen() {
  const { tripId, currency } = useLocalSearchParams<{ tripId: string; currency: string }>()
  const { session } = useAuthStore()
  const { addExpense } = useExpensesStore()

  const [members, setMembers] = useState<User[]>([])
  const [description, setDescription] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [paidBy, setPaidBy] = useState(session?.user.id ?? '')
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal')
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadMembers()
  }, [tripId])

  async function loadMembers() {
    const { data } = await supabase
      .from('trip_members')
      .select('users(*)')
      .eq('trip_id', tripId)

    if (data) {
      const users: User[] = data.map((m: any) => m.users).filter(Boolean)
      setMembers(users)
      setSelectedMembers(new Set(users.map((u) => u.id)))
    }
  }

  const amount = parseFloat(amountStr) || 0
  const selected = members.filter((m) => selectedMembers.has(m.id))

  function computeSplits(): { userId: string; amount: number }[] | null {
    if (selected.length === 0 || amount <= 0) return null

    if (splitMethod === 'equal') {
      const share = Math.round((amount / selected.length) * 100) / 100
      // Fix rounding: assign remainder to first person
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
        Alert.alert('Amounts don\'t add up', `Split total (${total.toFixed(2)}) must equal ${amount.toFixed(2)}.`)
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
        Alert.alert('Percentages don\'t add up', `Total is ${totalPct.toFixed(1)}%, must be 100%.`)
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
    if (!description.trim()) { Alert.alert('', 'Add a description.'); return }
    if (amount <= 0) { Alert.alert('', 'Enter an amount.'); return }

    const splits = computeSplits()
    if (!splits) return

    setLoading(true)
    const success = await addExpense({
      tripId,
      description: description.trim(),
      amount,
      paidBy,
      splitMethod,
      splits,
      expenseDate: new Date().toISOString().split('T')[0],
    })
    setLoading(false)

    if (success) {
      router.back()
    } else {
      Alert.alert('Error', 'Could not save expense. Please try again.')
    }
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
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Add expense</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          {loading
            ? <ActivityIndicator size="small" color="#1D9E75" />
            : <Text style={styles.save}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* Amount */}
        <View style={styles.amountRow}>
          <Text style={styles.currencySymbol}>{currency}</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0.00"
            value={amountStr}
            onChangeText={setAmountStr}
            keyboardType="decimal-pad"
            autoFocus
          />
        </View>

        {/* Description */}
        <TextInput
          style={styles.input}
          placeholder="Description (e.g. Hotel, Dinner)"
          value={description}
          onChangeText={setDescription}
          maxLength={80}
        />

        {/* Paid by */}
        <Text style={styles.label}>Paid by</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberScroll}>
          {members.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.memberPill, paidBy === m.id && styles.memberPillSelected]}
              onPress={() => setPaidBy(m.id)}
            >
              <Text style={[styles.memberPillText, paidBy === m.id && styles.memberPillTextSelected]}>
                {m.id === session?.user.id ? 'You' : m.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Split method */}
        <Text style={styles.label}>Split method</Text>
        <View style={styles.splitMethodRow}>
          {splitMethods.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.methodTab, splitMethod === s.key && styles.methodTabSelected]}
              onPress={() => setSplitMethod(s.key)}
            >
              <Text style={[styles.methodTabText, splitMethod === s.key && styles.methodTabTextSelected]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Split among */}
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
              >
                {isSelected && <Text style={styles.checkMark}>✓</Text>}
              </TouchableOpacity>
              <Text style={styles.memberName}>{m.id === session?.user.id ? 'You' : m.name}</Text>
              {isSelected && splitMethod !== 'equal' && (
                <TextInput
                  style={styles.splitAmountInput}
                  placeholder={splitMethod === 'percentage' ? '0%' : '0.00'}
                  value={exactAmounts[m.id] ?? ''}
                  onChangeText={(v) => setExactAmounts((prev) => ({ ...prev, [m.id]: v }))}
                  keyboardType="decimal-pad"
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
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#eee',
  },
  cancel: { fontSize: 16, color: '#888', width: 60 },
  title: { fontSize: 17, fontWeight: '600', color: '#1a1a1a' },
  save: { fontSize: 16, color: '#1D9E75', fontWeight: '600', width: 60, textAlign: 'right' },
  body: { padding: 16, gap: 4 },
  amountRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 20,
  },
  currencySymbol: { fontSize: 22, color: '#888', marginRight: 8, fontWeight: '500' },
  amountInput: { fontSize: 42, fontWeight: '600', color: '#1a1a1a', minWidth: 120 },
  input: {
    borderWidth: 0.5, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
    backgroundColor: '#fafafa', marginBottom: 8,
  },
  label: { fontSize: 12, color: '#888', fontWeight: '500', marginTop: 12, marginBottom: 6 },
  memberScroll: { marginBottom: 4 },
  memberPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 0.5, borderColor: '#ddd', backgroundColor: '#fafafa', marginRight: 8,
  },
  memberPillSelected: { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  memberPillText: { fontSize: 14, color: '#555', fontWeight: '500' },
  memberPillTextSelected: { color: '#fff' },
  splitMethodRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  methodTab: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    borderWidth: 0.5, borderColor: '#ddd', alignItems: 'center', backgroundColor: '#fafafa',
  },
  methodTabSelected: { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  methodTabText: { fontSize: 13, fontWeight: '500', color: '#666' },
  methodTabTextSelected: { color: '#fff' },
  splitRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0',
  },
  memberCheck: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5,
    borderColor: '#ccc', marginRight: 10, alignItems: 'center', justifyContent: 'center',
  },
  memberCheckSelected: { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  memberName: { flex: 1, fontSize: 15, color: '#1a1a1a' },
  splitAmountInput: {
    borderWidth: 0.5, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, width: 80,
    textAlign: 'right', backgroundColor: '#fafafa',
  },
  splitAmountDisplay: { fontSize: 14, color: '#555', fontWeight: '500' },
})
