import * as SecureStore from 'expo-secure-store'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/** Los mismos cinco temas y los mismos tokens que la web (src/app/globals.css). */
export interface Palette {
  background: string
  surface: string
  lowest: string
  low: string
  container: string
  high: string
  highest: string
  bright: string
  primary: string
  primaryDim: string
  secondary: string
  tertiary: string
  error: string
  onSurface: string
  onSurfaceVariant: string
  outline: string
  dark: boolean
}

export const THEMES = {
  obsidian: { name: 'Obsidian Glass', swatch: '#091328', p: { background: '#060e20', surface: '#060e20', lowest: '#000000', low: '#091328', container: '#0f1930', high: '#141f38', highest: '#192540', bright: '#1f2b49', primary: '#97a9ff', primaryDim: '#3e65ff', secondary: '#c180ff', tertiary: '#c5ffc9', error: '#ff6e84', onSurface: '#dee5ff', onSurfaceVariant: '#a3aac4', outline: '#40485d', dark: true } },
  light: { name: 'Cloud Light', swatch: '#e2e8f0', p: { background: '#f8fafc', surface: '#f1f5f9', lowest: '#ffffff', low: '#e2e8f0', container: '#cbd5e1', high: '#94a3b8', highest: '#64748b', bright: '#ffffff', primary: '#3b82f6', primaryDim: '#2563eb', secondary: '#8b5cf6', tertiary: '#10b981', error: '#ef4444', onSurface: '#0f172a', onSurfaceVariant: '#475569', outline: '#cbd5e1', dark: false } },
  nordic: { name: 'Nordic Aurora', swatch: '#3b4252', p: { background: '#2e3440', surface: '#2e3440', lowest: '#242933', low: '#3b4252', container: '#434c5e', high: '#4c566a', highest: '#81a1c1', bright: '#d8dee9', primary: '#88c0d0', primaryDim: '#5e81ac', secondary: '#b48ead', tertiary: '#a3be8c', error: '#bf616a', onSurface: '#eceff4', onSurfaceVariant: '#d8dee9', outline: '#4c566a', dark: true } },
  espresso: { name: 'Macchiato', swatch: '#3e322f', p: { background: '#2b211e', surface: '#2b211e', lowest: '#1f1816', low: '#3e322f', container: '#4a3e3b', high: '#5c4d4a', highest: '#73605c', bright: '#8a736f', primary: '#d4a373', primaryDim: '#a98467', secondary: '#ccd5ae', tertiary: '#e9edc9', error: '#e07a5f', onSurface: '#faedcd', onSurfaceVariant: '#d4c4a8', outline: '#5c4d4a', dark: true } },
  cyber: { name: 'Cyber Neon', swatch: '#0a0320', p: { background: '#010014', surface: '#010014', lowest: '#000000', low: '#0a0320', container: '#150638', high: '#240a59', highest: '#3b1090', bright: '#561bb7', primary: '#00ffcc', primaryDim: '#00b38f', secondary: '#ff00ff', tertiary: '#fcee0a', error: '#ff3333', onSurface: '#e0d8ff', onSurfaceVariant: '#a084e6', outline: '#4a2198', dark: true } },
} satisfies Record<string, { name: string; swatch: string; p: Palette }>

export type ThemeId = keyof typeof THEMES
export const THEME_IDS = Object.keys(THEMES) as ThemeId[]

// La web arranca en "cyber" cuando no hay nada guardado (ThemeSwitcher.tsx).
const DEFAULT_THEME: ThemeId = 'cyber'
const KEY = 'serenboard.theme'

/** `#rrggbb` + opacidad (0–1) → `#rrggbbaa`. Equivale a `bg-primary/20` de Tailwind. */
export function alpha(hex: string, opacity: number) {
  return hex + Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, '0')
}

interface ThemeValue {
  themeId: ThemeId
  palette: Palette
  setTheme: (id: ThemeId) => void
}

const Ctx = createContext<ThemeValue>({ themeId: DEFAULT_THEME, palette: THEMES[DEFAULT_THEME].p, setTheme: () => undefined })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME)

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((saved) => { if (saved && saved in THEMES) setThemeId(saved as ThemeId) })
      .catch(() => undefined)
  }, [])

  const setTheme = useCallback((id: ThemeId) => {
    setThemeId(id)
    SecureStore.setItemAsync(KEY, id).catch(() => undefined)
  }, [])

  const value = useMemo(() => ({ themeId, palette: THEMES[themeId].p, setTheme }), [themeId, setTheme])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)
export const usePalette = () => useContext(Ctx).palette

/** Mínimo táctil de Android (48 dp); la web móvil usa 44–48 px. */
export const TOUCH = 48
