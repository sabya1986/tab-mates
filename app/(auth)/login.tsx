import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')

  async function sendOtp() {
    if (!email) return
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase() })
    setLoading(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setOtpSent(true)
    }
  }

  async function verifyOtp() {
    if (!otp) return
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otp.trim(),
      type: 'email',
    })
    setLoading(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      router.replace('/(app)')
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Tab Mates</Text>
        <Text style={styles.subtitle}>Split trip expenses effortlessly</Text>

        {!otpSent ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={sendOtp}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Sending...' : 'Continue with email'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.hint}>
              We sent a 6-digit code to {email}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter code"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={verifyOtp}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Verifying...' : 'Verify code'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setOtpSent(false)}>
              <Text style={styles.link}>Use a different email</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: '600', marginBottom: 8, color: '#1a1a1a' },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 40 },
  hint: { fontSize: 14, color: '#666', marginBottom: 16 },
  input: {
    height: 50, borderWidth: 0.5, borderColor: '#ddd',
    borderRadius: 10, paddingHorizontal: 16, fontSize: 16,
    marginBottom: 16, backgroundColor: '#fafafa',
  },
  button: {
    height: 50, backgroundColor: '#1D9E75', borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { textAlign: 'center', color: '#1D9E75', fontSize: 14 },
})
