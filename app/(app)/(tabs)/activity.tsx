import { View, Text, StyleSheet, SafeAreaView } from 'react-native'
import { useTheme, type Colors } from '../../../lib/theme'

export default function ActivityScreen() {
  const C = useTheme()
  const styles = makeStyles(C)

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

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: { padding: 20, borderBottomWidth: 0.5, borderBottomColor: C.border },
    title: { fontSize: 28, fontWeight: '600', color: C.textPrimary },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { fontSize: 18, fontWeight: '500', color: C.textSecondary, marginBottom: 8 },
    emptySubtext: { fontSize: 14, color: C.textTertiary },
  })
}
