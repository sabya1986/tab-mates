import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert, ActivityIndicator
} from 'react-native'
import { router } from 'expo-router'
import { useTripsStore } from '../../../hooks/useTrips'

const CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'INR', 'SGD', 'JPY']

export default function NewTripScreen() {
  const { createTrip } = useTripsStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please give your trip a name.')
      return
    }
    setLoading(true)
    const trip = await createTrip(name.trim(), description.trim(), currency)
    setLoading(false)
    if (trip) {
      router.replace(`/(app)/trips/${trip.id}`)
    } else {
      Alert.alert('Error', 'Could not create trip. Please try again.')
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>New trip</Text>
        <TouchableOpacity onPress={handleCreate} disabled={loading}>
          {loading
            ? <ActivityIndicator size="small" color="#1D9E75" />
            : <Text style={styles.create}>Create</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.label}>Trip name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Banff Road Trip"
          value={name}
          onChangeText={setName}
          autoFocus
          maxLength={60}
        />

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Add a note about this trip"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          maxLength={200}
        />

        <Text style={styles.label}>Currency</Text>
        <View style={styles.currencyGrid}>
          {CURRENCIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.currencyPill, currency === c && styles.currencySelected]}
              onPress={() => setCurrency(c)}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#eee',
  },
  cancel: { fontSize: 16, color: '#888' },
  title: { fontSize: 17, fontWeight: '600', color: '#1a1a1a' },
  create: { fontSize: 16, color: '#1D9E75', fontWeight: '600' },
  body: { padding: 20, gap: 6 },
  label: { fontSize: 13, color: '#888', marginTop: 16, marginBottom: 6, fontWeight: '500' },
  input: {
    borderWidth: 0.5, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: '#fafafa',
  },
  multiline: { height: 90, textAlignVertical: 'top' },
  currencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  currencyPill: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 0.5, borderColor: '#ddd', backgroundColor: '#fafafa',
  },
  currencySelected: { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  currencyText: { fontSize: 14, color: '#555', fontWeight: '500' },
  currencyTextSelected: { color: '#fff' },
})
