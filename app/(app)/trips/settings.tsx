import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../hooks/useAuth'
import { alert } from '../../../lib/alert'
import { useTheme, type Colors } from '../../../lib/theme'
import type { Trip } from '../../../lib/types'

type TripStatus = 'active' | 'settled' | 'archived'

const STATUS_OPTIONS: { key: TripStatus; label: string; desc: string }[] = [
  { key: 'active', label: 'Active', desc: 'Trip is ongoing' },
  { key: 'settled', label: 'Settled', desc: 'All expenses are settled' },
  { key: 'archived', label: 'Archived', desc: 'Archived for reference' },
]

export default function TripSettingsScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>()
  const { session } = useAuthStore()
  const C = useTheme()
  const styles = makeStyles(C)

  const [trip, setTrip] = useState<Trip | null>(null)
  const [name, setName] = useState('')
  const [status, setStatus] = useState<TripStatus>('active')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const currentUserId = session?.user.id ?? ''
  const isCreator = trip?.created_by === currentUserId
  const isDirty = trip ? (name.trim() !== trip.name || status !== trip.status) : false

  useEffect(() => {
    loadTrip()
  }, [tripId])

  async function loadTrip() {
    const { data } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single()
    if (data) {
      setTrip(data)
      setName(data.name)
      setStatus(data.status)
    }
  }

  async function handleSave() {
    if (!name.trim()) { alert('', 'Trip name cannot be empty.'); return }
    setSaving(true)
    const { error } = await supabase
      .from('trips')
      .update({ name: name.trim(), status })
      .eq('id', tripId)
    setSaving(false)
    if (error) {
      alert('Error', 'Could not save changes. Please try again.')
    } else {
      router.back()
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete trip',
      `Delete "${trip?.name}"? All expenses and payments will be permanently deleted. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]
    )
  }

  async function doDelete() {
    setDeleting(true)
    const { error } = await supabase
      .from('trips')
      .delete()
      .eq('id', tripId)
    setDeleting(false)
    if (error) {
      alert('Error', 'Could not delete trip. Please try again.')
    } else {
      router.replace('/(app)/(tabs)')
    }
  }

  function confirmLeave() {
    Alert.alert(
      'Leave trip',
      `Leave "${trip?.name}"? You will no longer have access to this trip.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: doLeave },
      ]
    )
  }

  async function doLeave() {
    const { error } = await supabase
      .from('trip_members')
      .delete()
      .eq('trip_id', tripId)
      .eq('user_id', currentUserId)
    if (error) {
      alert('Error', 'Could not leave trip. Please try again.')
    } else {
      router.replace('/(app)/(tabs)')
    }
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.brand} />
        </View>
      </SafeAreaView>
    )
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
        <Text style={styles.title}>Trip settings</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || !isDirty}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Save changes"
          accessibilityState={{ disabled: saving || !isDirty }}
        >
          {saving
            ? <ActivityIndicator size="small" color={C.brand} />
            : <Text style={[styles.save, !isDirty && styles.saveDisabled]}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.label}>Trip name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Trip name"
          placeholderTextColor={C.textMuted}
          maxLength={60}
          returnKeyType="done"
          accessibilityLabel="Trip name"
        />

        <Text style={styles.label}>Status</Text>
        <View style={styles.statusGroup}>
          {STATUS_OPTIONS.map((opt) => {
            const selected = status === opt.key
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.statusRow, selected && styles.statusRowSelected]}
                onPress={() => setStatus(opt.key)}
                accessibilityRole="button"
                accessibilityLabel={`${opt.label}: ${opt.desc}`}
                accessibilityState={{ selected }}
              >
                <View style={styles.statusTextWrap}>
                  <Text style={[styles.statusLabel, selected && styles.statusLabelSelected]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.statusDesc, selected && styles.statusDescSelected]}>
                    {opt.desc}
                  </Text>
                </View>
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={styles.dangerZone}>
          {isCreator ? (
            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={confirmDelete}
              disabled={deleting}
              accessibilityRole="button"
              accessibilityLabel="Delete trip"
              accessibilityState={{ disabled: deleting }}
            >
              {deleting
                ? <ActivityIndicator size="small" color={C.danger} />
                : <Text style={styles.dangerBtnText}>Delete trip</Text>
              }
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={confirmLeave}
              accessibilityRole="button"
              accessibilityLabel="Leave trip"
            >
              <Text style={styles.dangerBtnText}>Leave trip</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: C.border,
    },
    cancel: { fontSize: 16, color: C.textTertiary, width: 60 },
    title: { fontSize: 17, fontWeight: '600', color: C.textPrimary },
    save: { fontSize: 16, color: C.brand, fontWeight: '600', width: 60, textAlign: 'right' },
    saveDisabled: { color: C.textMuted },
    body: { padding: 16, paddingBottom: 40 },
    label: { fontSize: 12, color: C.textTertiary, fontWeight: '500', marginTop: 16, marginBottom: 8 },
    input: {
      borderWidth: 0.5, borderColor: C.border, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
      backgroundColor: C.surface, color: C.textPrimary,
    },
    statusGroup: {
      borderWidth: 0.5, borderColor: C.border, borderRadius: 12,
      overflow: 'hidden',
    },
    statusRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14,
      backgroundColor: C.surface,
      borderBottomWidth: 0.5, borderBottomColor: C.borderSubtle,
    },
    statusRowSelected: { backgroundColor: C.brandSurface },
    statusTextWrap: { flex: 1 },
    statusLabel: { fontSize: 15, fontWeight: '500', color: C.textPrimary, marginBottom: 2 },
    statusLabelSelected: { color: C.brandText },
    statusDesc: { fontSize: 12, color: C.textMuted },
    statusDescSelected: { color: C.brandText },
    radio: {
      width: 20, height: 20, borderRadius: 10,
      borderWidth: 1.5, borderColor: C.border,
      alignItems: 'center', justifyContent: 'center',
    },
    radioSelected: { borderColor: C.brand },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.brand },
    dangerZone: { marginTop: 40 },
    dangerBtn: {
      paddingVertical: 14, alignItems: 'center',
      borderWidth: 0.5, borderColor: C.danger, borderRadius: 12,
      backgroundColor: C.dangerSurface, minHeight: 44, justifyContent: 'center',
    },
    dangerBtnText: { color: C.danger, fontSize: 16, fontWeight: '600' },
  })
}
