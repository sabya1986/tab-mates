import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, SafeAreaView,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { alert } from '../../lib/alert'
import { useTheme, type Colors } from '../../lib/theme'

export default function LoginScreen() {
  const { pendingToken } = useLocalSearchParams<{ pendingToken?: string }>()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [linkSent, setLinkSent] = useState(false)
  const C = useTheme()
  const styles = makeStyles(C)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        if (pendingToken) {
          router.replace({ pathname: '/join', params: { token: pendingToken } })
        } else {
          router.replace('/(app)')
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [pendingToken])

  async function sendLink() {
    if (!email.trim()) return
    setLoading(true)
    const WEB_BASE = 'https://tab-mates.vercel.app'
    const redirectTo = pendingToken
      ? `${WEB_BASE}/join?token=${pendingToken}`
      : WEB_BASE
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectTo },
    })
    setLoading(false)
    if (error) {
      alert('Error', error.message)
    } else {
      setLinkSent(true)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.inner}>
          <Text style={styles.title}>Tab Mates</Text>
          <Text style={styles.subtitle}>Split trip expenses effortlessly</Text>

          {!linkSent ? (
            <>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={C.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="done"
                onSubmitEditing={sendLink}
                accessibilityLabel="Email address"
              />
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={sendLink}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Continue with email"
                accessibilityState={{ disabled: loading }}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.buttonText}>Continue with email</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.checkInbox}>
              <Text style={styles.checkIcon}>✉️</Text>
              <Text style={styles.checkTitle}>Check your inbox</Text>
              <Text style={styles.checkBody}>
                We sent a sign-in link to{'\n'}
                <Text style={styles.emailHighlight}>{email}</Text>
              </Text>
              <Text style={styles.checkHint}>
                Open the email and tap the link — you'll be signed in automatically.
              </Text>
              <TouchableOpacity
                style={styles.resendRow}
                onPress={() => { setLinkSent(false); setEmail('') }}
                accessibilityRole="button"
                accessibilityLabel="Use a different email"
              >
                <Text style={styles.link}>Use a different email</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resendRow}
                onPress={sendLink}
                accessibilityRole="button"
                accessibilityLabel="Resend sign-in link"
              >
                <Text style={styles.link}>Resend link</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: C.bg },
    container: { flex: 1 },
    inner: { flex: 1, justifyContent: 'center', padding: 24 },
    title: { fontSize: 32, fontWeight: '600', marginBottom: 8, color: C.textPrimary },
    subtitle: { fontSize: 16, color: C.textTertiary, marginBottom: 32 },
    label: { fontSize: 13, fontWeight: '500', color: C.textTertiary, marginBottom: 6 },
    input: {
      height: 50, borderWidth: 0.5, borderColor: C.border,
      borderRadius: 10, paddingHorizontal: 16, fontSize: 16,
      marginBottom: 16, backgroundColor: C.surface, color: C.textPrimary,
    },
    button: {
      height: 50, backgroundColor: C.brand, borderRadius: 10,
      justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    checkInbox: { alignItems: 'center' },
    checkIcon: { fontSize: 48, marginBottom: 16 },
    checkTitle: { fontSize: 22, fontWeight: '600', color: C.textPrimary, marginBottom: 12 },
    checkBody: { fontSize: 15, color: C.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 16 },
    emailHighlight: { fontWeight: '600', color: C.textPrimary },
    checkHint: { fontSize: 14, color: C.textTertiary, textAlign: 'center', lineHeight: 20, marginBottom: 32 },
    resendRow: { paddingVertical: 10, marginBottom: 4 },
    link: { textAlign: 'center', color: C.brand, fontSize: 14 },
  })
}
