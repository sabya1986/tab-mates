import { useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { useTripsStore } from '../../../hooks/useTrips'
import { useAuthStore } from '../../../hooks/useAuth'
import { useTheme, type Colors } from '../../../lib/theme'
import type { Trip } from '../../../lib/types'

export default function TripsScreen() {
  const { trips, loading, fetchTrips } = useTripsStore()
  const { session } = useAuthStore()
  const C = useTheme()
  const styles = makeStyles(C)

  useEffect(() => {
    if (session) fetchTrips()
  }, [session])

  function renderTrip({ item }: { item: Trip }) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(app)/trips/${item.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.currency}, ${item.status === 'settled' ? 'settled' : 'active'}`}
      >
        <View style={styles.cardLeft}>
          <Text style={styles.tripName}>{item.name}</Text>
          <Text style={styles.tripMeta}>{item.currency} · {item.status}</Text>
        </View>
        <View style={[
          styles.statusBadge,
          item.status === 'settled' ? styles.badgeGreen : styles.badgeActive,
        ]}>
          <Text style={[
            styles.statusText,
            item.status === 'settled' ? styles.statusTextGreen : styles.statusTextActive,
          ]}>
            {item.status === 'settled' ? 'Settled' : 'Active'}
          </Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Tabs</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/(app)/trips/new')}
          accessibilityRole="button"
          accessibilityLabel="New trip"
        >
          <Text style={styles.addButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        renderItem={renderTrip}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchTrips} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No tabs yet</Text>
              <Text style={styles.emptySubtext}>Create one to start splitting expenses</Text>
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
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', padding: 20, paddingBottom: 12,
    },
    title: { fontSize: 28, fontWeight: '600', color: C.textPrimary },
    addButton: {
      backgroundColor: C.brand, paddingHorizontal: 16,
      paddingVertical: 8, borderRadius: 20,
    },
    addButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    list: { padding: 16, gap: 12 },
    card: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.surface, borderRadius: 12,
      padding: 16, borderWidth: 0.5, borderColor: C.border,
    },
    cardLeft: { flex: 1 },
    tripName: { fontSize: 16, fontWeight: '500', color: C.textPrimary, marginBottom: 4 },
    tripMeta: { fontSize: 13, color: C.textTertiary },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    badgeActive: { backgroundColor: C.brandSurface },
    badgeGreen: { backgroundColor: C.successSurface },
    statusText: { fontSize: 12, fontWeight: '500' },
    statusTextActive: { color: C.brandText },
    statusTextGreen: { color: C.success },
    empty: { flex: 1, alignItems: 'center', paddingTop: 80 },
    emptyText: { fontSize: 18, fontWeight: '500', color: C.textSecondary, marginBottom: 8 },
    emptySubtext: { fontSize: 14, color: C.textTertiary },
  })
}
