import { View, Text, StyleSheet, SafeAreaView } from 'react-native'

export default function ActivityScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
      </View>
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Coming soon</Text>
        <Text style={styles.emptySubtext}>Full activity feed across all trips</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 20, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  title: { fontSize: 28, fontWeight: '600', color: '#1a1a1a' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 18, fontWeight: '500', color: '#333', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#888' },
})
