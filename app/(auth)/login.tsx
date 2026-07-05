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
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [linkSent, setLinkSent] = useState(false)
  const [checkedEmail, setCheckedEmail] = useState('')
  const [accountExists, setAccountExists] = useState(false)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [wasNewSignup, setWasNewSignup] = useState(false)
  const C = useTheme()
  const styles = makeStyles(C)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        if (pendingToken) {
          router.replace({ pathname: '/join', params: { token: pendingToken } })
        } else {
          router.replace('/(app)/(tabs)')
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [pendingToken])

  async function checkEmailExists() {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return
    const { data } = await supabase.rpc('user_exists_with_email', { check_email: trimmed })
    setCheckedEmail(trimmed)
    setAccountExists(!!data)
  }

  const showNameField = !(accountExists && checkedEmail === email.trim().toLowerCase())

  async function sendLink() {
    if (!email.trim()) return
    setLoading(true)
    const WEB_BASE = 'https://tab-mates.vercel.app'
    let redirectTo = WEB_BASE
    if (pendingToken) {
      const params = new URLSearchParams({ token: pendingToken })
      if (name.trim()) params.set('name', name.trim())
      redirectTo = `${WEB_BASE}/join?${params.toString()}`
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: redirectTo,
        data: name.trim() ? { name: name.trim() } : undefined,
      },
    })
    setLoading(false)
    if (error) {
      alert('Error', error.message)
    } else {
      setWasNewSignup(showNameField)
      setLinkSent(true)
    }
  }

  async function verifyCode() {
    if (!code.trim()) return
    setVerifying(true)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    })
    setVerifying(false)
    if (error) {
      alert('Invalid code', 'That code is incorrect or has expired. Please try again or resend.')
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
                onBlur={checkEmailExists}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType={showNameField ? 'next' : 'done'}
                onSubmitEditing={showNameField ? undefined : sendLink}
                accessibilityLabel="Email address"
              />
              {showNameField ? (
                <>
                  <Text style={styles.label}>Your name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={pendingToken ? 'How should others see you?' : 'Display name (optional)'}
                    placeholderTextColor={C.textMuted}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    autoComplete="name"
                    textContentType="name"
                    returnKeyType="done"
                    onSubmitEditing={sendLink}
                    accessibilityLabel="Your name"
                  />
                </>
              ) : (
                <Text style={styles.welcomeBack}>Welcome back! We'll send a sign-in link.</Text>
              )}
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
                {wasNewSignup ? 'We sent a confirmation link to' : 'We sent a sign-in link to'}{'\n'}
                <Text style={styles.emailHighlight}>{email}</Text>
              </Text>
              {wasNewSignup ? (
                <Text style={styles.checkHint}>
                  Tap the link to activate your account. You'll be signed in automatically.
                </Text>
              ) : (
                <>
                  <Text style={styles.checkHint}>
                    Tap the link, or enter the code from the email below.
                  </Text>
                  <TextInput
                    style={[styles.input, styles.codeInput]}
                    placeholder="Code"
                    placeholderTextColor={C.textMuted}
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoComplete="one-time-code"
                    maxLength={10}
                    returnKeyType="done"
                    onSubmitEditing={verifyCode}
                    accessibilityLabel="Sign-in code"
                  />
                  <TouchableOpacity
                    style={[styles.button, (verifying || !code.trim()) && styles.buttonDisabled]}
                    onPress={verifyCode}
                    disabled={verifying || !code.trim()}
                    accessibilityRole="button"
                    accessibilityLabel="Verify code"
                    accessibilityState={{ disabled: verifying || !code.trim() }}
                  >
                    {verifying
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.buttonText}>Verify code</Text>
                    }
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={styles.resendRow}
                onPress={() => { setLinkSent(false); setEmail(''); setCode('') }}
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
    welcomeBack: { fontSize: 14, color: C.textTertiary, marginBottom: 16 },
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
    checkHint: { fontSize: 14, color: C.textTertiary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    codeInput: { width: '100%', textAlign: 'center', fontSize: 22, letterSpacing: 4 },
    resendRow: { paddingVertical: 10, marginBottom: 4 },
    link: { textAlign: 'center', color: C.brand, fontSize: 14 },
  })
}
