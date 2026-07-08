import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../../../hooks/useAuth'
import { supabase } from '../../../lib/supabase'
import { confirm, alert } from '../../../lib/alert'
import { useTheme, type Colors } from '../../../lib/theme'
import { canUseBillSplit } from '../../../lib/featureFlags'

export default function ProfileScreen() {
  const { session, signOut } = useAuthStore()
  const C = useTheme()
  const styles = makeStyles(C)

  const [name, setName] = useState('')
  const [savedName, setSavedName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const isDirty = name.trim() !== savedName && name.trim().length > 0

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    if (!session?.user.id) { setLoading(false); return }
    try {
      const { data } = await supabase
        .from('users')
        .select('name')
        .eq('id', session.user.id)
        .single()
      if (data) {
        setName(data.name)
        setSavedName(data.name)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveName() {
    if (!name.trim() || !session?.user.id) return
    setSaving(true)
    const { error } = await supabase
      .from('users')
      .update({ name: name.trim() })
      .eq('id', session.user.id)
    setSaving(false)
    if (error) {
      alert('Error', 'Could not save your name. Please try again.')
    } else {
      setSavedName(name.trim())
    }
  }

  function handleSignOut() {
    confirm('Sign out', 'Are you sure?', async () => {
      await signOut()
      router.replace('/(auth)/login')
    }, 'Sign out')
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(savedName || session?.user.email)?.slice(0, 2).toUpperCase() ?? '?'}
          </Text>
        </View>
        <Text style={styles.email}>{session?.user.email}</Text>

        <View style={styles.nameSection}>
          <Text style={styles.label}>Display name</Text>
          {loading ? (
            <ActivityIndicator color={C.brand} />
          ) : (
            <View style={styles.nameRow}>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={C.textMuted}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
                accessibilityLabel="Display name"
              />
              <TouchableOpacity
                style={[styles.saveBtn, !isDirty && styles.saveBtnDisabled]}
                onPress={handleSaveName}
                disabled={!isDirty || saving}
                accessibilityRole="button"
                accessibilityLabel="Save name"
                accessibilityState={{ disabled: !isDirty || saving }}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.saveBtnText}>Save</Text>
                }
              </TouchableOpacity>
            </View>
          )}
        </View>

        {canUseBillSplit(session?.user.email) && (
          <TouchableOpacity
            style={styles.billSplitBtn}
            onPress={() => router.push('/(app)/bill-split')}
            accessibilityRole="button"
            accessibilityLabel="Bill Split"
          >
            <Text style={styles.billSplitText}>📄 Bill Split</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleSignOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: { padding: 20, borderBottomWidth: 0.5, borderBottomColor: C.border },
    title: { fontSize: 28, fontWeight: '600', color: C.textPrimary },
    body: { flex: 1, alignItems: 'center', paddingTop: 48 },
    avatar: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: C.brandSurface, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    },
    avatarText: { fontSize: 24, fontWeight: '600', color: C.brandText },
    email: { fontSize: 16, color: C.textSecondary, marginBottom: 32 },
    nameSection: { width: '100%', paddingHorizontal: 24, marginBottom: 40 },
    label: { fontSize: 13, fontWeight: '500', color: C.textTertiary, marginBottom: 6 },
    nameRow: { flexDirection: 'row', gap: 10 },
    nameInput: {
      flex: 1, height: 44, borderWidth: 0.5, borderColor: C.border,
      borderRadius: 10, paddingHorizontal: 14, fontSize: 16,
      backgroundColor: C.surface, color: C.textPrimary,
    },
    saveBtn: {
      backgroundColor: C.brand, borderRadius: 10, paddingHorizontal: 18,
      height: 44, alignItems: 'center', justifyContent: 'center',
    },
    saveBtnDisabled: { opacity: 0.4 },
    saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    billSplitBtn: {
      borderWidth: 0.5, borderColor: C.border, borderRadius: 10,
      paddingHorizontal: 32, paddingVertical: 12,
      minHeight: 44, justifyContent: 'center', marginBottom: 12,
      backgroundColor: C.surface,
    },
    billSplitText: { fontSize: 15, color: C.textPrimary, fontWeight: '500' },
    signOutBtn: {
      borderWidth: 0.5, borderColor: C.border, borderRadius: 10,
      paddingHorizontal: 32, paddingVertical: 12,
      minHeight: 44, justifyContent: 'center',
    },
    signOutText: { fontSize: 15, color: C.danger, fontWeight: '500' },
  })
}
