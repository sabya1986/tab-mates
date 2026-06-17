import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../../../hooks/useAuth'
import { confirm } from '../../../lib/alert'
import { useTheme, type Colors } from '../../../lib/theme'

export default function ProfileScreen() {
  const { session, signOut } = useAuthStore()
  const C = useTheme()
  const styles = makeStyles(C)

  function handleSignOut() {
    confirm('Sign out', 'Are you sure?', async () => {
      await signOut()
      router.replace('/(auth)/login')
    }, 'Sign out')
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {session?.user.email?.slice(0, 2).toUpperCase() ?? '?'}
          </Text>
        </View>
        <Text style={styles.email}>{session?.user.email}</Text>
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleSignOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: { padding: 20, borderBottomWidth: 0.5, borderBottomColor: C.border },
    title: { fontSize: 28, fontWeight: '600', color: C.textPrimary },
    body: { flex: 1, alignItems: 'center', paddingTop: 48 },
    avatar: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: C.brandSurface, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    },
    avatarText: { fontSize: 24, fontWeight: '600', color: C.brandText },
    email: { fontSize: 16, color: C.textSecondary, marginBottom: 40 },
    signOutBtn: {
      borderWidth: 0.5, borderColor: C.border, borderRadius: 10,
      paddingHorizontal: 32, paddingVertical: 12,
      minHeight: 44, justifyContent: 'center',
    },
    signOutText: { fontSize: 15, color: C.danger, fontWeight: '500' },
  })
}
