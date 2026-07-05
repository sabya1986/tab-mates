import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useAuthStore } from '../hooks/useAuth'
import { acceptInvite } from '../hooks/useInvite'
import { supabase } from '../lib/supabase'

type State = 'loading' | 'prompt_login' | 'joining' | 'success' | 'already_member' | 'error'

export default function JoinScreen() {
  const { token, name } = useLocalSearchParams<{ token: string; name?: string }>()
  const { session, loading: authLoading } = useAuthStore()
  const [state, setState] = useState<State>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [tripId, setTripId] = useState<string | null>(null)
  const [tripName, setTripName] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!token) { setState('error'); setErrorMsg('Invalid invite link.'); return }

    if (!session) {
      // Not logged in — show login prompt then come back
      setState('prompt_login')
    } else {
      tryJoin()
    }
  }, [token, session, authLoading])

  async function tryJoin() {
    setState('joining')
    const result = await acceptInvite(token as string)

    if (!result.success) {
      if (result.error === 'not_authenticated') {
        setState('prompt_login')
        return
      }
      setState('error')
      setErrorMsg(result.error ?? 'Something went wrong.')
      return
    }

    // Save display name if the user provided one during sign-in
    if (name?.trim()) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('users').update({ name: name.trim() }).eq('id', user.id)
      }
    }

    // Load trip name for a friendly success screen
    if (result.tripId) {
      setTripId(result.tripId)
      const { data } = await supabase
        .from('trips')
        .select('name')
        .eq('id', result.tripId)
        .single()
      setTripName(data?.name ?? 'the trip')
    }

    setState('success')
  }

  function goToLogin() {
    // Store the token so we can resume after login
    router.push({ pathname: '/(auth)/login', params: { pendingToken: token } })
  }

  function goToTrip() {
    if (tripId) router.replace(`/(app)/trips/${tripId}`)
    else router.replace('/(app)/(tabs)')
  }

  if (state === 'loading' || state === 'joining') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1D9E75" />
        <Text style={styles.loadingText}>
          {state === 'joining' ? 'Joining trip...' : 'Loading...'}
        </Text>
      </View>
    )
  }

  if (state === 'prompt_login') {
    return (
      <View style={styles.center}>
        <Text style={styles.icon}>✈️</Text>
        <Text style={styles.heading}>You've been invited!</Text>
        <Text style={styles.body}>Sign in to join the trip and start splitting expenses.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={goToLogin}>
          <Text style={styles.primaryBtnText}>Sign in to join</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (state === 'success') {
    return (
      <View style={styles.center}>
        <Text style={styles.icon}>🎉</Text>
        <Text style={styles.heading}>You're in!</Text>
        <Text style={styles.body}>You've joined <Text style={{ fontWeight: '600' }}>{tripName}</Text>.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={goToTrip}>
          <Text style={styles.primaryBtnText}>View trip</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // error
  return (
    <View style={styles.center}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.heading}>Can't join</Text>
      <Text style={styles.body}>{errorMsg}</Text>
      <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/(app)/(tabs)')}>
        <Text style={styles.secondaryBtnText}>Go to my trips</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#fff' },
  icon: { fontSize: 52, marginBottom: 16 },
  heading: { fontSize: 24, fontWeight: '600', color: '#1a1a1a', marginBottom: 10, textAlign: 'center' },
  body: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  loadingText: { marginTop: 16, fontSize: 15, color: '#888' },
  primaryBtn: {
    backgroundColor: '#1D9E75', borderRadius: 12, width: '100%',
    paddingVertical: 14, alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    borderWidth: 0.5, borderColor: '#ddd', borderRadius: 12, width: '100%',
    paddingVertical: 14, alignItems: 'center', backgroundColor: '#fafafa',
  },
  secondaryBtnText: { color: '#555', fontSize: 16, fontWeight: '500' },
})
