import { Redirect } from 'expo-router'
import { useAuthStore } from '../hooks/useAuth'
import { View, ActivityIndicator } from 'react-native'

export default function Index() {
  const { session, loading } = useAuthStore()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return <Redirect href={session ? '/(app)' : '/(auth)/login'} />
}
