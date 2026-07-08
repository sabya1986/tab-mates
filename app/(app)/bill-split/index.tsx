import { useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../../../hooks/useAuth'
import { useBillSplitStore } from '../../../hooks/useBillSplit'
import { canUseBillSplit } from '../../../lib/featureFlags'
import { pickPdfAsBase64 } from '../../../lib/pdfToBase64'
import { alert } from '../../../lib/alert'
import { useTheme, type Colors } from '../../../lib/theme'

export default function BillSplitScreen() {
  const { session } = useAuthStore()
  const { draft, parsing, error, parseBill, reset } = useBillSplitStore()
  const C = useTheme()
  const styles = makeStyles(C)

  const allowed = canUseBillSplit(session?.user.email)

  useEffect(() => {
    if (!allowed) router.back()
  }, [allowed])

  useEffect(() => {
    reset()
  }, [])

  useEffect(() => {
    if (draft) router.push('/(app)/bill-split/review')
  }, [draft])

  useEffect(() => {
    if (error) alert('Could not read that bill', error)
  }, [error])

  if (!allowed) return null

  async function handlePick() {
    const picked = await pickPdfAsBase64()
    if (!picked) return
    await parseBill(picked.base64)
  }

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
        <Text style={styles.title}>Bill Split</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.icon}>📄</Text>
        <Text style={styles.heading}>Upload a T-Mobile bill</Text>
        <Text style={styles.subtext}>
          We'll read the PDF, split every line and account charge the same way the
          bill-split skill does, and let you send each person their total by email.
        </Text>

        <TouchableOpacity
          style={styles.pickBtn}
          onPress={handlePick}
          disabled={parsing}
          accessibilityRole="button"
          accessibilityLabel="Choose PDF bill"
          accessibilityState={{ disabled: parsing }}
        >
          {parsing
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.pickBtnText}>Choose PDF</Text>
          }
        </TouchableOpacity>
        {parsing && <Text style={styles.parsingHint}>Reading the bill — this can take a moment…</Text>}
      </View>
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
    body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    icon: { fontSize: 48, marginBottom: 16 },
    heading: { fontSize: 20, fontWeight: '600', color: C.textPrimary, marginBottom: 8, textAlign: 'center' },
    subtext: { fontSize: 14, color: C.textTertiary, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
    pickBtn: {
      backgroundColor: C.brand, borderRadius: 10, paddingHorizontal: 24,
      height: 48, alignItems: 'center', justifyContent: 'center', minWidth: 160,
    },
    pickBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    parsingHint: { marginTop: 14, fontSize: 13, color: C.textTertiary },
  })
}
