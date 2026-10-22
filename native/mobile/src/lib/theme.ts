import { useColorScheme } from 'react-native'

/** Mismos tokens que la web móvil (src/app/globals.css), claro y oscuro. */
const dark = {
  background: '#060e20',
  card: '#0f1930',
  cardHigh: '#141f38',
  primary: '#97a9ff',
  secondary: '#c180ff',
  tertiary: '#c5ffc9',
  error: '#ff6e84',
  text: '#dee5ff',
  textMuted: '#a3aac4',
  border: '#40485d',
  onPrimary: '#000000',
}

const light = {
  background: '#f8fafc',
  card: '#ffffff',
  cardHigh: '#e2e8f0',
  primary: '#2563eb',
  secondary: '#8b5cf6',
  tertiary: '#059669',
  error: '#dc2626',
  text: '#0f172a',
  textMuted: '#475569',
  border: '#cbd5e1',
  onPrimary: '#ffffff',
}

export type Theme = typeof dark

export function useTheme(): Theme {
  return useColorScheme() === 'light' ? light : dark
}

/** Mínimo táctil recomendado por Android (48 dp). */
export const TOUCH = 48
