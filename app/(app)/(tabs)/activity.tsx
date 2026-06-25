import { useEffect } from 'react'
import {
  View, Text, SectionList, TouchableOpacity, StyleSheet,
  SafeAreaView, RefreshControl, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../../../hooks/useAuth'
import { useActivity, groupIntoSections, timeAgo, type ActivityItem } from '../../../hooks/useActivity'
import { useTheme, type Colors } from '../../../lib/theme'

export default function ActivityScreen() {
  const { session } = useAuthStore()
  const currentUserId = session?.user.id ?? ''
  const { items, loading, refresh } = useActivity(currentUserId)
  const C = useTheme()
  const styles = makeStyles(C)

  useEffect(() => {
    if (currentUserId) refresh()
  }, [currentUserId])

  const sections = groupIntoSections(items)

  function actorText(name: string | undefined, isMe: boolean | undefined): string {
    return isMe ? 'You' : (name ?? 'Someone')
  }

  function renderItem({ item }: { item: ActivityItem }) {
    let icon = ''
    let primary: string
    let secondary: string

    if (item.type === 'expense') {
      icon = '💳'
      const actor = actorText(item.paidByName, item.isPaidByMe)
      primary = `${actor} paid ${item.currency} ${item.amount?.toFixed(2)} for ${item.description}`
      secondary = item.tripName
    } else if (item.type === 'payment') {
      icon = '✅'
      const actor = actorText(item.fromName, item.isFromMe)
      primary = `${actor} settled ${item.currency} ${item.amount?.toFixed(2)} with ${item.toName}`
      secondary = item.tripName
    } else {
      icon = '👋'
      const actor = actorText(item.userName, item.isMe)
      primary = `${actor} joined ${item.tripName}`
      secondary = ''
    }

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push(`/(app)/trips/${item.tripId}`)}
        accessibilityRole="button"
        accessibilityLabel={primary}
      >
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={styles.rowContent}>
          <Text style={styles.primaryText} numberOfLines={2}>{primary}</Text>
          <View style={styles.metaRow}>
            {secondary ? (
              <Text style={styles.tripTag} numberOfLines={1}>{secondary}</Text>
            ) : null}
            <Text style={styles.timeAgo}>{timeAgo(item.date)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.brand} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={C.brand} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>No activity yet</Text>
              <Text style={styles.emptySubtext}>
                Expenses and payments across your trips will appear here
              </Text>
            </View>
          }
          stickySectionHeadersEnabled={false}
          contentContainerStyle={items.length === 0 ? styles.emptyContainer : undefined}
        />
      )}
    </SafeAreaView>
  )
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: {
      padding: 20, paddingBottom: 12,
      borderBottomWidth: 0.5, borderBottomColor: C.border,
    },
    title: { fontSize: 28, fontWeight: '600', color: C.textPrimary },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    sectionHeader: {
      paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6,
      backgroundColor: C.bg,
    },
    sectionTitle: {
      fontSize: 12, fontWeight: '600', color: C.textMuted,
      textTransform: 'uppercase', letterSpacing: 0.6,
    },
    row: {
      flexDirection: 'row', alignItems: 'flex-start',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 0.5, borderBottomColor: C.borderSubtle,
    },
    iconWrap: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center',
      marginRight: 12, marginTop: 1,
    },
    icon: { fontSize: 16 },
    rowContent: { flex: 1 },
    primaryText: { fontSize: 14, color: C.textPrimary, lineHeight: 20, marginBottom: 4 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tripTag: {
      fontSize: 12, color: C.brandText, backgroundColor: C.brandSurface,
      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
      overflow: 'hidden', flexShrink: 1,
    },
    timeAgo: { fontSize: 12, color: C.textMuted },
    empty: { alignItems: 'center', paddingHorizontal: 32 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyText: { fontSize: 17, fontWeight: '500', color: C.textSecondary, marginBottom: 8 },
    emptySubtext: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 20 },
    emptyContainer: { flex: 1, justifyContent: 'center' },
  })
}
