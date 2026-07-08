import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
import { Platform } from 'react-native'

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let result = ''
  let i = 0
  for (; i + 2 < bytes.length; i += 3) {
    result += BASE64_CHARS[bytes[i] >> 2]
    result += BASE64_CHARS[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)]
    result += BASE64_CHARS[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)]
    result += BASE64_CHARS[bytes[i + 2] & 63]
  }
  const remaining = bytes.length - i
  if (remaining === 1) {
    result += BASE64_CHARS[bytes[i] >> 2]
    result += BASE64_CHARS[(bytes[i] & 3) << 4]
    result += '=='
  } else if (remaining === 2) {
    result += BASE64_CHARS[bytes[i] >> 2]
    result += BASE64_CHARS[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)]
    result += BASE64_CHARS[(bytes[i + 1] & 15) << 2]
    result += '='
  }
  return result
}

export type PickedPdf = { base64: string; name: string }

// On web, expo-document-picker returns the file already base64-encoded (as a
// data URL). On native, it only returns a local file:// uri, so we read the
// bytes ourselves and encode them.
export async function pickPdfAsBase64(): Promise<PickedPdf | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' })
  if (result.canceled || !result.assets?.[0]) return null
  const asset = result.assets[0]

  if (Platform.OS === 'web' && asset.base64) {
    const commaIdx = asset.base64.indexOf(',')
    const base64 = commaIdx >= 0 ? asset.base64.slice(commaIdx + 1) : asset.base64
    return { base64, name: asset.name }
  }

  const file = new File(asset.uri)
  const buffer = await file.arrayBuffer()
  return { base64: arrayBufferToBase64(buffer), name: asset.name }
}
