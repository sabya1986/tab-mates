import { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  FlatList, TextInput, Modal, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import { useExpensesStore } from '../../../hooks/useExpenses'
import { usePaymentsStore } from '../../../hooks/usePayments'
import { useBalances, type Balance } from '../../../hooks/useBalances'
import { useAuthStore } from '../../../hooks/useAuth'
import { alert } from '../../../lib/alert'
import { useTheme, type Colors } from '../../../lib/theme'
import type { Trip, User } from '../../../lib/types'

export default function BalancesScreen() {
  const { tripId, currency } = useLocalSearchParams<{ tripId: string; currency: string }>()
  const { session } = useAuthStore()
  const { expenses, fetchExpenses } = useExpensesStore()
  const { payments, fetchPayments, recordPayment } = usePaymentsStore()
  const [members, setMembers] = useState<User[]>([])
  const [trip, setTrip] = useState<Trip | null>(null)
  const [settleTarget, setSettleTarget] = useState<Balance | null>(null)
  const [noteText, setNoteText] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)
  const C = useTheme()
  const styles = makeStyles(C)

  const currentUserId = session?.user.id ?? ''
  const { balances, memberBalances, myNet } = useBalances(
    expenses, payments, members, currentUserId, trip?.simplify_debts ?? false
  )

  useEffect(() => {
    if (!tripId) return
    fetchExpenses(tripId)
    fetchPayments(tripId)
    loadMembers()
    loadTrip()
  }, [tripId])

  async function loadMembers() {
    const { data } = await supabase
      .from('trip_members')
      .select('users(*)')
      .eq('trip_id', tripId)
    if (data) {
      setMembers(data.map((m: any) => m.users).filter(Boolean))
    }
  }

  async function loadTrip() {
    const { data } = await supabase.from('trips').select('*').eq('id', tripId).single()
    if (data) setTrip(data)
  }

  function nameOf(userId: string) {
    if (userId === currentUserId) return 'You'
    return members.find((m) => m.id === userId)?.name ?? 'Member'
  }

  async function handleRecordPayment() {
    if (!settleTarget) return
    setSavingPayment(true)
    const success = await recordPayment({
      tripId,
      toUserId: settleTarget.toUserId,
      amount: settleTarget.amount,
      note: noteText.trim() || undefined,
    })
    setSavingPayment(false)
    if (success) {
      setSettleTarget(null)
      setNoteText('')
    } else {
      alert('Error', 'Could not record payment. Please try again.')
    }
  }

  function renderBalance({ item }: { item: Balance }) {
    const isMyDebt = item.fromUserId === currentUserId
    const isMyCredit = item.toUserId === currentUserId
    const highlight = isMyDebt || isMyCredit

    return (
      <View style={[styles.balanceRow, highlight && styles.balanceRowHighlight]}>
        <View style={styles.balanceLeft}>
          <Text style={styles.balanceLine}>
            <Text style={{ fontWeight: '600' }}>{nameOf(item.fromUserId)}</Text>
            {' → '}
            <Text style={{ fontWeight: '600' }}>{nameOf(item.toUserId)}</Text>
          </Text>
          <Text style={styles.balanceAmount}>
            {currency} {item.amount.toFixed(2)}
          </Text>
        </View>
        {isMyDebt && (
          <TouchableOpacity
            style={styles.settleBtn}
            onPress={() => setSettleTarget(item)}
            accessibilityRole="button"
            accessibilityLabel={`Settle debt of ${currency} ${item.amount.toFixed(2)} to ${nameOf(item.toUserId)}`}
          >
            <Text style={styles.settleBtnText}>Settle</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Back to trip"
        >
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Balances</Text>
        <View style={{ width: 60 }} />
      </View>

      <FlatList
        data={balances}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderBalance}
        ListHeaderComponent={
          <View>
            <View style={[
              styles.summaryCard,
              myNet < 0 ? styles.summaryRed : myNet > 0 ? styles.summaryGreen : styles.summaryNeutral,
            ]}>
              <Text style={[styles.summaryLabel, myNet < 0 ? styles.textRed : myNet > 0 ? styles.textGreen : styles.textGray]}>
                {myNet < 0 ? 'You owe overall' : myNet > 0 ? "You're owed overall" : 'All settled up'}
              </Text>
              <Text style={[styles.summaryAmount, myNet < 0 ? styles.textRed : myNet > 0 ? styles.textGreen : styles.textGray]}>
                {currency} {Math.abs(myNet).toFixed(2)}
              </Text>
            </View>

            <Text style={styles.sectionLabel}>All members</Text>
            {memberBalances.map((mb) => (
              <View key={mb.userId} style={styles.memberRow}>
                <View style={styles.memberInitials}>
                  <Text style={styles.memberInitialsText}>
                    {nameOf(mb.userId).slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.memberRowName}>{nameOf(mb.userId)}</Text>
                <Text style={[
                  styles.memberNet,
                  mb.net < 0 ? styles.textRed : mb.net > 0 ? styles.textGreen : styles.textGray,
                ]}>
                  {mb.net === 0 ? 'settled' : `${mb.net > 0 ? '+' : ''}${currency} ${mb.net.toFixed(2)}`}
                </Text>
              </View>
            ))}

            <Text style={styles.sectionLabel}>
              {trip?.simplify_debts ? 'Simplified debts' : 'Who owes whom'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>All settled up!</Text>
            <Text style={styles.emptySubtext}>No outstanding balances</Text>
          </View>
        }
      />

      <Modal visible={!!settleTarget} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Record payment</Text>
            <Text style={styles.modalSubtitle}>
              You → {nameOf(settleTarget?.toUserId ?? '')}
            </Text>
            <Text style={styles.modalAmount}>
              {currency} {settleTarget?.amount.toFixed(2)}
            </Text>
            <Text style={styles.noteLabel}>Note (optional)</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="e.g. via Venmo, cash"
              placeholderTextColor={C.textMuted}
              value={noteText}
              onChangeText={setNoteText}
              returnKeyType="done"
              accessibilityLabel="Payment note"
            />
            <Text style={styles.modalDisclaimer}>
              This records the payment in the app only. No real money is transferred.
            </Text>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={handleRecordPayment}
              disabled={savingPayment}
              accessibilityRole="button"
              accessibilityLabel="Confirm payment"
              accessibilityState={{ disabled: savingPayment }}
            >
              {savingPayment
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.confirmBtnText}>Confirm payment</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSettleTarget(null)}
              style={styles.cancelLinkRow}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelLink}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    title: { fontSize: 17, fontWeight: '600', color: C.textPrimary },
    summaryCard: { margin: 16, borderRadius: 12, padding: 16 },
    summaryRed: { backgroundColor: C.dangerSurface },
    summaryGreen: { backgroundColor: C.successSurface },
    summaryNeutral: { backgroundColor: C.surface2 },
    summaryLabel: { fontSize: 13, fontWeight: '500', marginBottom: 4 },
    summaryAmount: { fontSize: 28, fontWeight: '600' },
    textRed: { color: C.danger },
    textGreen: { color: C.success },
    textGray: { color: C.textTertiary },
    sectionLabel: {
      fontSize: 11, color: C.textMuted, fontWeight: '500',
      paddingHorizontal: 16, paddingVertical: 8, letterSpacing: 0.5,
    },
    memberRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 10,
      borderBottomWidth: 0.5, borderBottomColor: C.borderSubtle,
    },
    memberInitials: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: C.brandSurface, alignItems: 'center', justifyContent: 'center', marginRight: 10,
    },
    memberInitialsText: { fontSize: 12, fontWeight: '600', color: C.brandText },
    memberRowName: { flex: 1, fontSize: 15, color: C.textPrimary },
    memberNet: { fontSize: 14, fontWeight: '600' },
    balanceRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 0.5, borderBottomColor: C.borderSubtle,
    },
    balanceRowHighlight: { backgroundColor: C.brandSurface },
    balanceLeft: { flex: 1 },
    balanceLine: { fontSize: 14, color: C.textPrimary, marginBottom: 2 },
    balanceAmount: { fontSize: 15, fontWeight: '600', color: C.textPrimary },
    settleBtn: {
      backgroundColor: C.brand, paddingHorizontal: 14,
      paddingVertical: 10, borderRadius: 16, minHeight: 44,
      justifyContent: 'center',
    },
    settleBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { fontSize: 18, fontWeight: '600', color: C.success, marginBottom: 6 },
    emptySubtext: { fontSize: 13, color: C.textMuted },
    modalOverlay: {
      flex: 1, backgroundColor: C.overlay,
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 24, paddingBottom: 40,
    },
    modalTitle: { fontSize: 18, fontWeight: '600', color: C.textPrimary, marginBottom: 4 },
    modalSubtitle: { fontSize: 14, color: C.textTertiary, marginBottom: 4 },
    modalAmount: { fontSize: 32, fontWeight: '600', color: C.textPrimary, marginBottom: 16 },
    noteLabel: { fontSize: 13, fontWeight: '500', color: C.textTertiary, marginBottom: 6 },
    noteInput: {
      borderWidth: 0.5, borderColor: C.border, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
      backgroundColor: C.surface, color: C.textPrimary, marginBottom: 10,
    },
    modalDisclaimer: { fontSize: 12, color: C.textMuted, marginBottom: 20, textAlign: 'center' },
    confirmBtn: {
      backgroundColor: C.brand, borderRadius: 12,
      paddingVertical: 14, alignItems: 'center', marginBottom: 12,
      minHeight: 44, justifyContent: 'center',
    },
    confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    cancelLinkRow: { paddingVertical: 12, alignItems: 'center' },
    cancelLink: { color: C.textTertiary, fontSize: 15 },
  })
}
