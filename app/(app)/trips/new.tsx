import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useTripsStore } from '../../../hooks/useTrips'
import { alert } from '../../../lib/alert'
import { useTheme, type Colors } from '../../../lib/theme'

const CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'INR', 'SGD', 'JPY']

export default function NewTripScreen() {
  const { createTrip } = useTripsStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [loading, setLoading] = useState(false)
  const descRef = useRef<TextInput>(null)
  const C = useTheme()
  const styles = makeStyles(C)

  async function handleCreate() {
    if (!name.trim()) {
      alert('Name required', 'Please give your trip a name.')
      return
    }
    setLoading(true)
    const trip = await createTrip(name.trim(), description.trim(), currency)
    setLoading(false)
    if (trip) {
      router.replace(`/(app)/trips/${trip.id}`)
    } else {
      alert('Error', 'Could not create trip. Please try again.')
    }
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
        <Text style={styles.title}>New trip</Text>
        <TouchableOpacity
          onPress={handleCreate}
          disabled={loading}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Create trip"
          accessibilityState={{ disabled: loading }}
        >
          {loading
            ? <ActivityIndicator size="small" color={C.brand} />
            : <Text style={styles.create}>Create</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.label}>Trip name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Banff Road Trip"
          placeholderTextColor={C.textMuted}
          value={name}
          onChangeText={setName}
          autoFocus
          maxLength={60}
          returnKeyType="next"
          onSubmitEditing={() => descRef.current?.focus()}
          accessibilityLabel="Trip name"
        />

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          ref={descRef}
          style={[styles.input, styles.multiline]}
          placeholder="Add a note about this trip"
          placeholderTextColor={C.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          maxLength={200}
          returnKeyType="done"
          accessibilityLabel="Trip description"
        />

        <Text style={styles.label}>Currency</Text>
        <View style={styles.currencyGrid}>
          {CURRENCIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.currencyPill, currency === c && styles.currencySelected]}
              onPress={() => setCurrency(c)}
              accessibilityRole="button"
              accessibilityLabel={`${c} currency`}
              accessibilityState={{ selected: currency === c }}
            >
              <Text style={[styles.currencyText, currency === c && styles.currencyTextSelected]}>
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
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
    cancel: { fontSize: 16, color: C.textTertiary },
    title: { fontSize: 17, fontWeight: '600', color: C.textPrimary },
    create: { fontSize: 16, color: C.brand, fontWeight: '600' },
    body: { padding: 20, gap: 6 },
    label: { fontSize: 13, color: C.textTertiary, marginTop: 16, marginBottom: 6, fontWeight: '500' },
    input: {
      borderWidth: 0.5, borderColor: C.border, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
      backgroundColor: C.surface, color: C.textPrimary,
    },
    multiline: { height: 90, textAlignVertical: 'top' },
    currencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    currencyPill: {
      paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
      borderWidth: 0.5, borderColor: C.border, backgroundColor: C.surface,
      minHeight: 44, justifyContent: 'center',
    },
    currencySelected: { backgroundColor: C.brand, borderColor: C.brand },
    currencyText: { fontSize: 14, color: C.textSecondary, fontWeight: '500' },
    currencyTextSelected: { color: '#fff' },
  })
}
