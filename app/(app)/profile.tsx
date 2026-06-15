import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../../hooks/useAuth'

export default function ProfileScreen() {
  const { session, signOut } = useAuthStore()

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive',
        onPress: async () => {
          await signOut()
          router.replace('/(auth)/login')
        },
      },
    ])
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
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 20, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  title: { fontSize: 28, fontWeight: '600', color: '#1a1a1a' },
  body: { flex: 1, alignItems: 'center', paddingTop: 48 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#E1F5EE', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 24, fontWeight: '600', color: '#0F6E56' },
  email: { fontSize: 16, color: '#555', marginBottom: 40 },
  signOutBtn: {
    borderWidth: 0.5, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 32, paddingVertical: 12,
  },
  signOutText: { fontSize: 15, color: '#A32D2D', fontWeight: '500' },
})
