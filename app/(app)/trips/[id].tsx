import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, RefreshControl,
} from 'react-native'
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import { useExpensesStore } from '../../../hooks/useExpenses'
import { usePaymentsStore } from '../../../hooks/usePayments'
import { useBalances } from '../../../hooks/useBalances'
import { useAuthStore } from '../../../hooks/useAuth'
import { useTheme, type Colors } from '../../../lib/theme'
import { timeAgo } from '../../../hooks/useActivity'
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
  const C = useTheme()
  const styles = makeStyles(C)

  const currentUserId = session?.user.id ?? ''
  const tripExpenses = useMemo(() => expenses.filter((e) => e.trip_id === id), [expenses, id])
  const tripPayments = useMemo(() => payments.filter((p) => p.trip_id === id), [payments, id])
  const { myNet } = useBalances(tripExpenses, tripPayments, members, currentUserId, trip?.simplify_debts ?? false)

  useEffect(() => {
    if (!id) return
    loadAll()
    return setupRealtime()
  }, [id])

  useFocusEffect(
    useCallback(() => {
      if (id) loadTrip()
    }, [id])
  )

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

    return () => { supabase.removeChannel(channel) }
  }

  async function onRefresh() {
    setRefreshing(true)
    await loadAll()
    setRefreshing(false)
  }

  const totalSpent = tripExpenses.reduce((sum, e) => sum + Number(e.amount), 0)

  function renderExpense({ item }: { item: ExpenseWithSplits }) {
    const myShare = item.splits.find((s) => s.user_id === currentUserId)?.amount ?? 0
    const iPaid = item.paid_by === currentUserId
    const payerName = members.find((m) => m.id === item.paid_by)?.name ?? 'member'
    const wasEdited = new Date(item.updated_at).getTime() - new Date(item.created_at).getTime() > 1000
    const editorName = item.updated_by === currentUserId
      ? 'you'
      : members.find((m) => m.id === item.updated_by)?.name ?? 'member'

    return (
      <TouchableOpacity
        style={styles.expenseRow}
        onPress={() => router.push({
          pathname: '/(app)/expenses/new',
          params: { tripId: id, currency: trip?.currency ?? 'USD', expenseId: item.id },
        })}
        accessibilityRole="button"
        accessibilityLabel={`Edit expense: ${item.description}`}
      >
        <View style={styles.expenseLeft}>
          <Text style={styles.expenseName}>{item.description}</Text>
          <Text style={styles.expenseMeta}>
            {iPaid ? 'You paid' : `Paid by ${payerName}`} · {item.expense_date}
            {wasEdited && ` · edited ${timeAgo(item.updated_at)} by ${editorName}`}
          </Text>
        </View>
        <View style={styles.expenseRight}>
          <Text style={styles.expenseAmount}>{trip?.currency} {Number(item.amount).toFixed(2)}</Text>
          {myShare > 0 && (
            <Text style={[styles.expenseShare, iPaid ? styles.sharePositive : styles.shareNegative]}>
              {iPaid ? 'You paid' : `Your share: ${trip?.currency} ${myShare.toFixed(2)}`}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Back to trips"
        >
          <Text style={styles.back}>← Trips</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{trip?.name ?? '...'}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/(app)/trips/invite', params: { tripId: id } })}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Invite members"
          >
            <Text style={styles.headerBtn}>Invite</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/(app)/trips/settings', params: { tripId: id } })}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Trip settings"
          >
            <Text style={styles.headerBtn}>···</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={tripExpenses}
        keyExtractor={(item) => item.id}
        renderItem={renderExpense}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
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
                <Text style={styles.statVal}>{tripExpenses.length}</Text>
                <Text style={styles.statLabel}>Expenses</Text>
              </View>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.push({
                  pathname: '/(app)/expenses/new',
                  params: { tripId: id, currency: trip?.currency ?? 'USD' },
                })}
                accessibilityRole="button"
                accessibilityLabel="Add expense"
              >
                <Text style={styles.primaryBtnText}>+ Add expense</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => router.push({
                  pathname: '/(app)/settle/[tripId]',
                  params: { tripId: id, currency: trip?.currency ?? 'USD' },
                })}
                accessibilityRole="button"
                accessibilityLabel="View balances"
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

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 16, borderBottomWidth: 0.5, borderBottomColor: C.border,
    },
    back: { fontSize: 16, color: C.brand, width: 60 },
    title: { fontSize: 17, fontWeight: '600', color: C.textPrimary, flex: 1, textAlign: 'center' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16, width: 80, justifyContent: 'flex-end' },
    headerBtn: { fontSize: 15, color: C.brand, fontWeight: '500' },
    statsRow: { flexDirection: 'row', padding: 16, gap: 8 },
    stat: {
      flex: 1, backgroundColor: C.surface2, borderRadius: 12,
      padding: 12, alignItems: 'center',
    },
    statVal: { fontSize: 15, fontWeight: '600', color: C.textPrimary, marginBottom: 2 },
    statLabel: { fontSize: 11, color: C.textTertiary },
    red: { color: C.danger },
    green: { color: C.success },
    actions: { flexDirection: 'row', padding: 16, paddingTop: 4, gap: 10 },
    primaryBtn: {
      flex: 2, backgroundColor: C.brand, borderRadius: 10,
      paddingVertical: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center',
    },
    primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    secondaryBtn: {
      flex: 1, borderWidth: 0.5, borderColor: C.border, borderRadius: 10,
      paddingVertical: 12, alignItems: 'center', backgroundColor: C.surface,
      minHeight: 44, justifyContent: 'center',
    },
    secondaryBtnText: { color: C.textSecondary, fontWeight: '500', fontSize: 15 },
    sectionLabel: {
      fontSize: 11, color: C.textMuted, fontWeight: '500',
      paddingHorizontal: 16, paddingBottom: 4, letterSpacing: 0.5,
    },
    expenseRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 0.5, borderBottomColor: C.borderSubtle,
    },
    expenseLeft: { flex: 1, marginRight: 8 },
    expenseName: { fontSize: 15, fontWeight: '500', color: C.textPrimary, marginBottom: 3 },
    expenseMeta: { fontSize: 12, color: C.textTertiary },
    expenseRight: { alignItems: 'flex-end' },
    expenseAmount: { fontSize: 15, fontWeight: '600', color: C.textPrimary },
    expenseShare: { fontSize: 12, marginTop: 2 },
    sharePositive: { color: C.success },
    shareNegative: { color: C.danger },
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { fontSize: 16, fontWeight: '500', color: C.textSecondary, marginBottom: 6 },
    emptySubtext: { fontSize: 13, color: C.textMuted },
  })
}
