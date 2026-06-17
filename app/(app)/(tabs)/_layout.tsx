import { Tabs } from 'expo-router'
import { useTheme } from '../../../lib/theme'

export default function TabsLayout() {
  const C = useTheme()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.brand,
        tabBarInactiveTintColor: C.textTertiary,
        tabBarStyle: {
          borderTopWidth: 0.5,
          borderTopColor: C.border,
          backgroundColor: C.bg,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Trips' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  )
}
