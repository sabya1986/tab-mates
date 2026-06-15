import { useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, RefreshControl, Alert
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import { useExpensesStore } from '../../../hooks/useExpenses'
import { usePaymentsStore } from '../../../hooks/usePayments'
import { useBalances } from '../../../hooks/useBalances'
import { useAuthStore } from '../../../hooks/useAuth'
import type { Trip, User } from '../../../lib/types'
import type { ExpenseWithSplits } from '../../../hooks/useExpenses'

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session } = useAuthStore()
  const { expenses, loading: expLoading, fetchExpenses } = useExpensesStore()
  const { payments, fetchPayments } = usePaymentsStore()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [members, setMembers] = useState<User[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const currentUserId = session?.user.id ?? ''
  const { myNet } = useBalances(expenses, payments, members, currentUserId)

  useEffect(() => {
    if (!id) return
    loadAll()
    setupRealtime()
  }, [id])

  async function loadAll() {
    await Promise.all([loadTrip(), fetchExpenses(id), fetchPayments(id)])
  }

  async function loadTrip() {
    const { data } = await supabase
      .from('trips')
      .select('*')
      .eq('id', id)
      .single()
    if (data) setTrip(data)

    const { data: membersData } = await supabase
      .from('trip_members')
      .select('users(*)')
      .eq('trip_id', id)
    if (membersData) {
      setMembers(membersData.map((m: any) => m.users).filter(Boolean))
    }
  }

  function setupRealtime() {
    const channel = supabase
      .channel(`trip-${id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'expenses',
        filter: `trip_id=eq.${id}`,
      }, () => fetchExpenses(id))
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'payments',
        filter: `trip_id=eq.${id}`,
      }, () => fetchPayments(id))
      .subscribe()

    return () => supabase.removeChannel(channel)
  }

  async function onRefresh() {
    setRefreshing(true)
    await loadAll()
    setRefreshing(false)
  }

  const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  function renderExpense({ item }: { item: ExpenseWithSplits }) {
    const myShare = item.splits.find((s) => s.user_id === currentUserId)?.amount ?? 0
    const iPaid = item.paid_by === currentUserId

    return (
      <View style={styles.expenseRow}>
        <View style={styles.expenseLeft}>
          <Text style={styles.expenseName}>{item.description}</Text>
          <Text style={styles.expenseMeta}>
            {iPaid ? 'You paid' : `Paid by member`} · {item.expense_date}
          </Text>
        </View>
        <View style={styles.expenseRight}>
          <Text style={styles.expenseAmount}>{trip?.currency} {Number(item.amount).toFixed(2)}</Text>
          {myShare > 0 && (
            <Text style={[styles.expenseShare, iPaid ? styles.sharePositive : styles.shareNegative]}>
              {iPaid ? `You paid` : `Your share: ${trip?.currency} ${myShare.toFixed(2)}`}
            </Text>
          )}
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Trips</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{trip?.name ?? '...'}</Text>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/(app)/trips/invite', params: { tripId: id } })}
        >
          <Text style={styles.inviteBtn}>Invite</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        renderItem={renderExpense}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statVal}>
                  {trip?.currency} {totalSpent.toFixed(2)}
                </Text>
                <Text style={styles.statLabel}>Total spent</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statVal, myNet < 0 ? styles.red : myNet > 0 ? styles.green : {}]}>
                  {myNet < 0 ? '-' : myNet > 0 ? '+' : ''}{trip?.currency} {Math.abs(myNet).toFixed(2)}
                </Text>
                <Text style={styles.statLabel}>{myNet < 0 ? 'You owe' : myNet > 0 ? "You're owed" : 'Settled'}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{expenses.length}</Text>
                <Text style={styles.statLabel}>Expenses</Text>
              </View>
            </View>

            {/* Action buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.push({
                  pathname: '/(app)/expenses/new',
                  params: { tripId: id, currency: trip?.currency ?? 'USD' },
                })}
              >
                <Text style={styles.primaryBtnText}>+ Add expense</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => router.push({
                  pathname: '/(app)/settle/[tripId]',
                  params: { tripId: id, currency: trip?.currency ?? 'USD' },
                })}
              >
                <Text style={styles.secondaryBtnText}>Balances</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>Expenses</Text>
          </View>
        }
        ListEmptyComponent={
          !expLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No expenses yet</Text>
              <Text style={styles.emptySubtext}>Tap "+ Add expense" to record the first one</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#eee',
  },
  back: { fontSize: 16, color: '#1D9E75', width: 60 },
  title: { fontSize: 17, fontWeight: '600', color: '#1a1a1a', flex: 1, textAlign: 'center' },
  inviteBtn: { fontSize: 15, color: '#1D9E75', fontWeight: '500', width: 60, textAlign: 'right' },
  statsRow: {
    flexDirection: 'row', padding: 16, gap: 8,
  },
  stat: {
    flex: 1, backgroundColor: '#f6f6f6', borderRadius: 12,
    padding: 12, alignItems: 'center',
  },
  statVal: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 2 },
  statLabel: { fontSize: 11, color: '#888' },
  red: { color: '#A32D2D' },
  green: { color: '#3B6D11' },
  actions: { flexDirection: 'row', padding: 16, paddingTop: 4, gap: 10 },
  primaryBtn: {
    flex: 2, backgroundColor: '#1D9E75', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  secondaryBtn: {
    flex: 1, borderWidth: 0.5, borderColor: '#ddd', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', backgroundColor: '#fafafa',
  },
  secondaryBtnText: { color: '#555', fontWeight: '500', fontSize: 15 },
  sectionLabel: {
    fontSize: 11, color: '#aaa', fontWeight: '500',
    paddingHorizontal: 16, paddingBottom: 4, letterSpacing: 0.5,
  },
  expenseRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0',
  },
  expenseLeft: { flex: 1, marginRight: 8 },
  expenseName: { fontSize: 15, fontWeight: '500', color: '#1a1a1a', marginBottom: 3 },
  expenseMeta: { fontSize: 12, color: '#999' },
  expenseRight: { alignItems: 'flex-end' },
  expenseAmount: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  expenseShare: { fontSize: 12, marginTop: 2 },
  sharePositive: { color: '#3B6D11' },
  shareNegative: { color: '#A32D2D' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, fontWeight: '500', color: '#555', marginBottom: 6 },
  emptySubtext: { fontSize: 13, color: '#aaa' },
})
