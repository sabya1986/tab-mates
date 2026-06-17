import { Alert, Platform } from 'react-native'

// RN's Alert.alert() is a no-op on web (react-native-web stubs it out).
// This falls back to window.alert/confirm there so messages are never silent.
export function alert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title)
    return
  }
  Alert.alert(title, message)
}

export function confirm(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmLabel = 'OK'
) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm()
    return
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ])
}
