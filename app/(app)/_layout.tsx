import { Tabs } from 'expo-router'
import { useColorScheme } from 'react-native'

export default function AppLayout() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1D9E75',
        tabBarInactiveTintColor: isDark ? '#666' : '#999',
        tabBarStyle: {
          borderTopWidth: 0.5,
          borderTopColor: isDark ? '#333' : '#eee',
          backgroundColor: isDark ? '#1a1a1a' : '#fff',
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Trips' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="trips" options={{ href: null }} />
      <Tabs.Screen name="expenses" options={{ href: null }} />
      <Tabs.Screen name="settle" options={{ href: null }} />
    </Tabs>
  )
}
