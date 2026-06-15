import { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  FlatList, Alert, TextInput, Modal, ActivityIndicator
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import { useExpensesStore } from '../../../hooks/useExpenses'
import { usePaymentsStore } from '../../../hooks/usePayments'
import { useBalances, type Balance } from '../../../hooks/useBalances'
import { useAuthStore } from '../../../hooks/useAuth'
import type { User } from '../../../lib/types'

export default function BalancesScreen() {
  const { tripId, currency } = useLocalSearchParams<{ tripId: string; currency: string }>()
  const { session } = useAuthStore()
  const { expenses, fetchExpenses } = useExpensesStore()
  const { payments, fetchPayments, recordPayment } = usePaymentsStore()
  const [members, setMembers] = useState<User[]>([])
  const [settleTarget, setSettleTarget] = useState<Balance | null>(null)
  const [noteText, setNoteText] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)

  const currentUserId = session?.user.id ?? ''
  const { balances, myBalances, memberBalances, myNet } = useBalances(
    expenses, payments, members, currentUserId
  )

  useEffect(() => {
    if (!tripId) return
    fetchExpenses(tripId)
    fetchPayments(tripId)
    loadMembers()
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
      Alert.alert('Error', 'Could not record payment. Please try again.')
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
        <TouchableOpacity onPress={() => router.back()}>
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
            {/* My net summary */}
            <View style={[
              styles.summaryCard,
              myNet < 0 ? styles.summaryRed : myNet > 0 ? styles.summaryGreen : styles.summaryNeutral
            ]}>
              <Text style={[styles.summaryLabel, myNet < 0 ? styles.textRed : myNet > 0 ? styles.textGreen : styles.textGray]}>
                {myNet < 0 ? 'You owe overall' : myNet > 0 ? "You're owed overall" : 'All settled up'}
              </Text>
              <Text style={[styles.summaryAmount, myNet < 0 ? styles.textRed : myNet > 0 ? styles.textGreen : styles.textGray]}>
                {currency} {Math.abs(myNet).toFixed(2)}
              </Text>
            </View>

            {/* Member balances */}
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
                  mb.net < 0 ? styles.textRed : mb.net > 0 ? styles.textGreen : styles.textGray
                ]}>
                  {mb.net === 0 ? 'settled' : `${mb.net > 0 ? '+' : ''}${currency} ${mb.net.toFixed(2)}`}
                </Text>
              </View>
            ))}

            <Text style={styles.sectionLabel}>Simplified debts</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>All settled up!</Text>
            <Text style={styles.emptySubtext}>No outstanding balances</Text>
          </View>
        }
      />

      {/* Settle up modal */}
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
            <TextInput
              style={styles.noteInput}
              placeholder="Note (e.g. via Venmo, cash)"
              value={noteText}
              onChangeText={setNoteText}
            />
            <Text style={styles.modalDisclaimer}>
              This records the payment in the app only. No real money is transferred.
            </Text>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={handleRecordPayment}
              disabled={savingPayment}
            >
              {savingPayment
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.confirmBtnText}>Confirm payment</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSettleTarget(null)}>
              <Text style={styles.cancelLink}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  title: { fontSize: 17, fontWeight: '600', color: '#1a1a1a' },
  summaryCard: { margin: 16, borderRadius: 12, padding: 16 },
  summaryRed: { backgroundColor: '#FCEBEB' },
  summaryGreen: { backgroundColor: '#EAF3DE' },
  summaryNeutral: { backgroundColor: '#f6f6f6' },
  summaryLabel: { fontSize: 13, fontWeight: '500', marginBottom: 4 },
  summaryAmount: { fontSize: 28, fontWeight: '600' },
  textRed: { color: '#A32D2D' },
  textGreen: { color: '#3B6D11' },
  textGray: { color: '#666' },
  sectionLabel: {
    fontSize: 11, color: '#aaa', fontWeight: '500',
    paddingHorizontal: 16, paddingVertical: 8, letterSpacing: 0.5,
  },
  memberRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0',
  },
  memberInitials: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#E1F5EE', alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  memberInitialsText: { fontSize: 12, fontWeight: '600', color: '#0F6E56' },
  memberRowName: { flex: 1, fontSize: 15, color: '#1a1a1a' },
  memberNet: { fontSize: 14, fontWeight: '600' },
  balanceRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0',
  },
  balanceRowHighlight: { backgroundColor: '#fafff8' },
  balanceLeft: { flex: 1 },
  balanceLine: { fontSize: 14, color: '#1a1a1a', marginBottom: 2 },
  balanceAmount: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  settleBtn: {
    backgroundColor: '#1D9E75', paddingHorizontal: 14,
    paddingVertical: 7, borderRadius: 16,
  },
  settleBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#3B6D11', marginBottom: 6 },
  emptySubtext: { fontSize: 13, color: '#aaa' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: '#888', marginBottom: 4 },
  modalAmount: { fontSize: 32, fontWeight: '600', color: '#1a1a1a', marginBottom: 16 },
  noteInput: {
    borderWidth: 0.5, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    backgroundColor: '#fafafa', marginBottom: 10,
  },
  modalDisclaimer: { fontSize: 12, color: '#aaa', marginBottom: 20, textAlign: 'center' },
  confirmBtn: {
    backgroundColor: '#1D9E75', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginBottom: 12,
  },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelLink: { textAlign: 'center', color: '#888', fontSize: 15 },
})
