import { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Share, Alert, ActivityIndicator, ScrollView
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import QRCode from 'react-native-qrcode-svg'
import { useInvite, inviteUrl } from '../../../hooks/useInvite'
import { supabase } from '../../../lib/supabase'

export default function InviteScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>()
  const { token, loading, error, generateInvite } = useInvite()
  const [tripName, setTripName] = useState('')
  const [copied, setCopied] = useState(false)

  const link = token ? inviteUrl(token) : null

  useEffect(() => {
    if (!tripId) return
    loadTripName()
    generateInvite(tripId)
  }, [tripId])

  async function loadTripName() {
    const { data } = await supabase.from('trips').select('name').eq('id', tripId).single()
    if (data) setTripName(data.name)
  }

  async function handleCopy() {
    if (!link) return
    await Clipboard.setStringAsync(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  async function handleShare() {
    if (!link) return
    await Share.share({
      message: `Join me on "${tripName}" in Tab Mates!\n\n${link}`,
      url: link,
    })
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Invite members</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.tripName}>{tripName}</Text>
        <Text style={styles.subtitle}>
          Share this link or QR code. Anyone with it can join the trip.
          Link expires in 7 days.
        </Text>

        {/* QR Code */}
        <View style={styles.qrCard}>
          {loading && <ActivityIndicator size="large" color="#1D9E75" style={{ height: 200 }} />}
          {error && <Text style={styles.errorText}>{error}</Text>}
          {link && (
            <QRCode
              value={link}
              size={200}
              color="#1a1a1a"
              backgroundColor="#fff"
            />
          )}
        </View>

        {/* Link display */}
        {link && (
          <View style={styles.linkBox}>
            <Text style={styles.linkText} numberOfLines={2}>{link}</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryBtn, !link && styles.btnDisabled]}
            onPress={handleShare}
            disabled={!link}
          >
            <Text style={styles.primaryBtnText}>Share invite</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, !link && styles.btnDisabled]}
            onPress={handleCopy}
            disabled={!link}
          >
            <Text style={styles.secondaryBtnText}>
              {copied ? '✓ Copied!' : 'Copy link'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Refresh invite */}
        {link && (
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => generateInvite(tripId)}
          >
            <Text style={styles.refreshBtnText}>Generate new link</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.disclaimer}>
          Only share with people you trust. Anyone with this link can join the trip.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#eee',
  },
  back: { fontSize: 16, color: '#1D9E75', width: 60 },
  title: { fontSize: 17, fontWeight: '600', color: '#1a1a1a' },
  body: { padding: 24, alignItems: 'center' },
  tripName: { fontSize: 22, fontWeight: '600', color: '#1a1a1a', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  qrCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24,
    borderWidth: 0.5, borderColor: '#eee', marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  linkBox: {
    backgroundColor: '#f6f6f6', borderRadius: 10, padding: 12,
    marginBottom: 20, width: '100%',
  },
  linkText: { fontSize: 12, color: '#555', textAlign: 'center', lineHeight: 18 },
  actions: { width: '100%', gap: 10, marginBottom: 12 },
  primaryBtn: {
    backgroundColor: '#1D9E75', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    borderWidth: 0.5, borderColor: '#ddd', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', backgroundColor: '#fafafa',
  },
  secondaryBtnText: { color: '#555', fontSize: 16, fontWeight: '500' },
  btnDisabled: { opacity: 0.4 },
  refreshBtn: { marginTop: 4, marginBottom: 20 },
  refreshBtnText: { color: '#1D9E75', fontSize: 14 },
  errorText: { color: '#A32D2D', fontSize: 14, textAlign: 'center', height: 200, textAlignVertical: 'center' },
  disclaimer: { fontSize: 12, color: '#bbb', textAlign: 'center', marginTop: 8 },
})
