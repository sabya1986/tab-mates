import { useColorScheme } from 'react-native'

const light = {
  bg: '#ffffff',
  surface: '#fafafa',
  surface2: '#f6f6f6',
  border: '#eeeeee',
  borderSubtle: '#f0f0f0',
  textPrimary: '#1a1a1a',
  textSecondary: '#555555',
  textTertiary: '#888888',
  textMuted: '#aaaaaa',
  brand: '#1D9E75',
  brandSurface: '#E1F5EE',
  brandText: '#0F6E56',
  danger: '#A32D2D',
  dangerSurface: '#FCEBEB',
  success: '#3B6D11',
  successSurface: '#EAF3DE',
  overlay: 'rgba(0,0,0,0.45)',
}

const dark = {
  bg: '#111111',
  surface: '#1c1c1e',
  surface2: '#2c2c2e',
  border: '#3a3a3c',
  borderSubtle: '#2c2c2e',
  textPrimary: '#f2f2f7',
  textSecondary: '#aeaeb2',
  textTertiary: '#8e8e93',
  textMuted: '#636366',
  brand: '#34c98e',
  brandSurface: '#0d2b1f',
  brandText: '#4de0a8',
  danger: '#ff6b6b',
  dangerSurface: '#3a1515',
  success: '#7ec450',
  successSurface: '#1a3008',
  overlay: 'rgba(0,0,0,0.7)',
}

export type Colors = typeof light

export function useTheme(): Colors {
  const scheme = useColorScheme()
  return scheme === 'dark' ? dark : light
}
