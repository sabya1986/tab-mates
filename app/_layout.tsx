import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Linking from 'expo-linking'
import { router } from 'expo-router'
import { useAuthStore } from '../hooks/useAuth'

export default function RootLayout() {
  const { initialize } = useAuthStore()

  useEffect(() => {
    initialize()
    handleInitialUrl()

    // Handle deep links while app is open
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url))
    return () => sub.remove()
  }, [])

  async function handleInitialUrl() {
    const url = await Linking.getInitialURL()
    if (url) handleUrl(url)
  }

  function handleUrl(url: string) {
    const { queryParams } = Linking.parse(url)
    const token = queryParams?.token
    if (token && typeof token === 'string') {
      router.push({ pathname: '/join', params: { token } })
    }
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  )
}
