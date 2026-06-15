import { useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, RefreshControl
} from 'react-native'
import { router } from 'expo-router'
import { useTripsStore } from '../../hooks/useTrips'
import { useAuthStore } from '../../hooks/useAuth'
import type { Trip } from '../../lib/types'

export default function TripsScreen() {
  const { trips, loading, fetchTrips } = useTripsStore()
  const { session } = useAuthStore()

  useEffect(() => {
    if (session) fetchTrips()
  }, [session])

  function renderTrip({ item }: { item: Trip }) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(app)/trips/${item.id}`)}
      >
        <View style={styles.cardLeft}>
          <Text style={styles.tripName}>{item.name}</Text>
          <Text style={styles.tripMeta}>{item.currency} · {item.status}</Text>
        </View>
        <View style={[
          styles.statusBadge,
          item.status === 'settled' ? styles.badgeGreen : styles.badgeActive
        ]}>
          <Text style={[
            styles.statusText,
            item.status === 'settled' ? styles.statusTextGreen : styles.statusTextActive
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
        <Text style={styles.title}>My Trips</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/(app)/trips/new')}
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
              <Text style={styles.emptyText}>No trips yet</Text>
              <Text style={styles.emptySubtext}>Create one to start splitting expenses</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 20, paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '600', color: '#1a1a1a' },
  addButton: {
    backgroundColor: '#1D9E75', paddingHorizontal: 16,
    paddingVertical: 8, borderRadius: 20,
  },
  addButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  list: { padding: 16, gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fafafa', borderRadius: 12,
    padding: 16, borderWidth: 0.5, borderColor: '#eee',
  },
  cardLeft: { flex: 1 },
  tripName: { fontSize: 16, fontWeight: '500', color: '#1a1a1a', marginBottom: 4 },
  tripMeta: { fontSize: 13, color: '#888' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeActive: { backgroundColor: '#E1F5EE' },
  badgeGreen: { backgroundColor: '#EAF3DE' },
  statusText: { fontSize: 12, fontWeight: '500' },
  statusTextActive: { color: '#0F6E56' },
  statusTextGreen: { color: '#3B6D11' },
  empty: { flex: 1, alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 18, fontWeight: '500', color: '#333', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#888' },
})
