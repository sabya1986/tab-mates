import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useBillSplitStore, type DraftLine } from '../../../hooks/useBillSplit'
import { alert } from '../../../lib/alert'
import { useTheme, type Colors } from '../../../lib/theme'

type EditableLine = DraftLine & { name: string; email: string }

export default function BillSplitReviewScreen() {
  const { draft, computing, error, computeBill } = useBillSplitStore()
  const C = useTheme()
  const styles = makeStyles(C)

  const [lines, setLines] = useState<EditableLine[]>([])

  useEffect(() => {
    if (!draft) {
      router.replace('/(app)/bill-split')
      return
    }
    setLines(
      draft.lines.map((l) => ({ ...l, name: l.person_name ?? '', email: l.email ?? '' }))
    )
  }, [draft])

  useEffect(() => {
    if (error) alert('Could not compute the split', error)
  }, [error])

  if (!draft) return null

  const accountTotal = draft.account_charges.reduce((s, c) => s + c.amount, 0)
  const allResolved = lines.length > 0 && lines.every((l) => l.name.trim() && l.email.trim())

  function updateLine(index: number, patch: Partial<EditableLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  async function handleCompute() {
    if (!allResolved || !draft) return

    const people = new Map<string, { name: string; email: string; lines: { number: string; type: DraftLine['line_type']; amount: number }[] }>()
    for (const line of lines) {
      const key = `${line.name.trim().toLowerCase()}|${line.email.trim().toLowerCase()}`
      if (!people.has(key)) {
        people.set(key, { name: line.name.trim(), email: line.email.trim(), lines: [] })
      }
      people.get(key)!.lines.push({ number: line.phone_number, type: line.line_type, amount: line.amount })
    }

    const ok = await computeBill({
      billing_period: draft.billing_period,
      bill_total: draft.bill_total,
      people: Array.from(people.values()),
      account_charges: draft.account_charges,
    })
    if (ok) router.push('/(app)/bill-split/result')
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
        <Text style={styles.title}>Review</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.period}>{draft.billing_period}</Text>
        <Text style={styles.billTotal}>Bill total: ${draft.bill_total?.toFixed(2)}</Text>

        {draft.notes.length > 0 && (
          <View style={styles.notesBox}>
            {draft.notes.map((n, i) => (
              <Text key={i} style={styles.noteText}>⚠️ {n}</Text>
            ))}
          </View>
        )}

        <Text style={styles.sectionLabel}>Who owns each line?</Text>
        {lines.map((line, i) => (
          <View key={line.phone_number} style={styles.lineCard}>
            <View style={styles.lineHeader}>
              <Text style={styles.linePhone}>{line.phone_number}</Text>
              <Text style={styles.lineType}>{line.line_type}</Text>
              <Text style={styles.lineAmount}>${line.amount.toFixed(2)}</Text>
            </View>
            <View style={styles.lineInputs}>
              <TextInput
                style={styles.lineInput}
                placeholder="Name"
                placeholderTextColor={C.textMuted}
                value={line.name}
                onChangeText={(v) => updateLine(i, { name: v })}
                accessibilityLabel={`Name for line ${line.phone_number}`}
              />
              <TextInput
                style={styles.lineInput}
                placeholder="Email"
                placeholderTextColor={C.textMuted}
                value={line.email}
                onChangeText={(v) => updateLine(i, { email: v })}
                keyboardType="email-address"
                autoCapitalize="none"
                accessibilityLabel={`Email for line ${line.phone_number}`}
              />
            </View>
          </View>
        ))}

        <Text style={styles.sectionLabel}>
          Account-level charges (split evenly, ${accountTotal.toFixed(2)} total)
        </Text>
        {draft.account_charges.map((c, i) => (
          <View key={i} style={styles.chargeRow}>
            <Text style={styles.chargeDesc}>{c.description}</Text>
            <Text style={styles.chargeAmount}>${c.amount.toFixed(2)}</Text>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.computeBtn, !allResolved && styles.computeBtnDisabled]}
          onPress={handleCompute}
          disabled={!allResolved || computing}
          accessibilityRole="button"
          accessibilityLabel="Compute split"
          accessibilityState={{ disabled: !allResolved || computing }}
        >
          {computing
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.computeBtnText}>Compute split</Text>
          }
        </TouchableOpacity>
        {!allResolved && (
          <Text style={styles.hint}>Fill in a name and email for every line to continue.</Text>
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
    body: { padding: 16, gap: 4 },
    period: { fontSize: 20, fontWeight: '600', color: C.textPrimary },
    billTotal: { fontSize: 14, color: C.textTertiary, marginBottom: 12 },
    notesBox: {
      backgroundColor: C.dangerSurface, borderRadius: 10, padding: 12, marginBottom: 12, gap: 4,
    },
    noteText: { fontSize: 13, color: C.danger },
    sectionLabel: { fontSize: 12, color: C.textTertiary, fontWeight: '500', marginTop: 16, marginBottom: 8 },
    lineCard: {
      borderWidth: 0.5, borderColor: C.border, borderRadius: 10,
      backgroundColor: C.surface, padding: 12, marginBottom: 8,
    },
    lineHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    linePhone: { fontSize: 14, fontWeight: '600', color: C.textPrimary, flex: 1 },
    lineType: {
      fontSize: 11, color: C.brandText, backgroundColor: C.brandSurface,
      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden',
    },
    lineAmount: { fontSize: 14, fontWeight: '500', color: C.textSecondary },
    lineInputs: { flexDirection: 'row', gap: 8 },
    lineInput: {
      flex: 1, height: 40, borderWidth: 0.5, borderColor: C.border,
      borderRadius: 8, paddingHorizontal: 10, fontSize: 14,
      backgroundColor: C.bg, color: C.textPrimary,
    },
    chargeRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: C.borderSubtle,
    },
    chargeDesc: { fontSize: 14, color: C.textPrimary, flex: 1 },
    chargeAmount: { fontSize: 14, color: C.textSecondary },
    computeBtn: {
      backgroundColor: C.brand, borderRadius: 10, height: 48,
      alignItems: 'center', justifyContent: 'center', marginTop: 24,
    },
    computeBtnDisabled: { opacity: 0.4 },
    computeBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    hint: { fontSize: 12, color: C.textMuted, textAlign: 'center', marginTop: 8 },
  })
}
