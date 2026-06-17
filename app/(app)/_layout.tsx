import { Stack } from 'expo-router'

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="trips/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="trips/[id]" />
      <Stack.Screen name="trips/invite" options={{ presentation: 'modal' }} />
      <Stack.Screen name="expenses/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="settle/[tripId]" />
    </Stack>
  )
}
