import { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useBillSplitStore, type SendResult } from '../../../hooks/useBillSplit'
import { alert } from '../../../lib/alert'
import { useTheme, type Colors } from '../../../lib/theme'

export default function BillSplitResultScreen() {
  const { computed, sending, error, sendEmails, reset } = useBillSplitStore()
  const C = useTheme()
  const styles = makeStyles(C)

  const [sendResult, setSendResult] = useState<SendResult | null>(null)

  useEffect(() => {
    if (!computed) router.replace('/(app)/bill-split')
  }, [computed])

  useEffect(() => {
    if (error) alert('Something went wrong', error)
  }, [error])

  if (!computed) return null

  const sharedEmailGroups = Object.values(
    computed.rows.reduce<Record<string, string[]>>((acc, row) => {
      const key = row.email.toLowerCase()
      acc[key] = [...(acc[key] ?? []), row.name]
      return acc
    }, {})
  ).filter((names) => names.length > 1)

  async function handleSend() {
    const result = await sendEmails()
    if (result) setSendResult(result)
  }

  function handleDone() {
    reset()
    setSendResult(null)
    router.replace('/(app)/(tabs)')
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.cancel}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Split</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {computed.reconciled === false && (
          <View style={styles.mismatchBox}>
            <Text style={styles.mismatchText}>
              ⚠️ Computed total (${computed.grandTotal.toFixed(2)}) doesn't match the bill total
              (${computed.billTotal?.toFixed(2)}). Go back and check for a missing or
              miscategorized charge before sending.
            </Text>
          </View>
        )}
        {computed.reconciled === true && (
          <Text style={styles.reconciledText}>
            ✓ Reconciled — matches bill total of ${computed.billTotal?.toFixed(2)}
          </Text>
        )}

        {sharedEmailGroups.map((names, i) => (
          <Text key={i} style={styles.sharedEmailNote}>
            ℹ️ {names.join(' and ')} share an email — they'll get one combined message with a total.
          </Text>
        ))}

        {computed.rows.map((row) => {
          const sent = sendResult?.find((r) => r.email.toLowerCase() === row.email.toLowerCase())
          return (
            <View key={`${row.name}|${row.email}`} style={styles.row}>
              <View style={styles.rowTop}>
                <Text style={styles.name}>{row.name}</Text>
                <Text style={styles.total}>${row.total.toFixed(2)}</Text>
              </View>
              <Text style={styles.email}>{row.email}</Text>
              <Text style={styles.linesDesc}>{row.linesDesc || 'No personal lines'}</Text>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Lines ${row.lineSubtotal.toFixed(2)} + Account share ${row.accountShare.toFixed(2)}</Text>
              </View>
              {sent && (
                <Text style={sent.sent ? styles.sentOk : styles.sentFail}>
                  {sent.sent ? '✓ Sent' : `✗ Failed: ${sent.error}`}
                </Text>
              )}
            </View>
          )
        })}

        <View style={styles.grandTotalRow}>
          <Text style={styles.grandTotalLabel}>Total</Text>
          <Text style={styles.grandTotalValue}>${computed.grandTotal.toFixed(2)}</Text>
        </View>

        {sendResult ? (
          <TouchableOpacity style={styles.doneBtn} onPress={handleDone} accessibilityRole="button" accessibilityLabel="Done">
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={handleSend}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel="Send emails"
            accessibilityState={{ disabled: sending }}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.sendBtnText}>Send emails</Text>
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
    body: { padding: 16 },
    mismatchBox: { backgroundColor: C.dangerSurface, borderRadius: 10, padding: 12, marginBottom: 16 },
    mismatchText: { fontSize: 13, color: C.danger, lineHeight: 18 },
    reconciledText: { fontSize: 13, color: C.success, marginBottom: 16 },
    sharedEmailNote: { fontSize: 13, color: C.textTertiary, marginBottom: 8 },
    row: {
      borderWidth: 0.5, borderColor: C.border, borderRadius: 10,
      backgroundColor: C.surface, padding: 14, marginBottom: 10,
    },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    name: { fontSize: 16, fontWeight: '600', color: C.textPrimary },
    total: { fontSize: 16, fontWeight: '700', color: C.brandText },
    email: { fontSize: 13, color: C.textTertiary, marginBottom: 6 },
    linesDesc: { fontSize: 13, color: C.textSecondary, marginBottom: 4 },
    breakdownRow: {},
    breakdownLabel: { fontSize: 12, color: C.textMuted },
    sentOk: { fontSize: 12, color: C.success, marginTop: 6, fontWeight: '500' },
    sentFail: { fontSize: 12, color: C.danger, marginTop: 6, fontWeight: '500' },
    grandTotalRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: C.border, marginTop: 4,
    },
    grandTotalLabel: { fontSize: 16, fontWeight: '600', color: C.textPrimary },
    grandTotalValue: { fontSize: 16, fontWeight: '700', color: C.textPrimary },
    sendBtn: {
      backgroundColor: C.brand, borderRadius: 10, height: 48,
      alignItems: 'center', justifyContent: 'center', marginTop: 20,
    },
    sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    doneBtn: {
      borderWidth: 0.5, borderColor: C.border, borderRadius: 10, height: 48,
      alignItems: 'center', justifyContent: 'center', marginTop: 20, backgroundColor: C.surface,
    },
    doneBtnText: { color: C.textPrimary, fontSize: 16, fontWeight: '600' },
  })
}
