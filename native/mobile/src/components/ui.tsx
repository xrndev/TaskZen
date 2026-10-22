import type { LucideIcon } from 'lucide-react-native'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Animated, Image, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle } from 'react-native'
import { avatarColor, initials } from '@domain/lib/initials'
import { imageSource } from '@/lib/api'
import { alpha, TOUCH, usePalette } from '@/lib/theme'

type Weight = '400' | '500' | '600' | '700' | '800' | '900'
const FAMILY: Record<Weight, string> = {
  '400': 'Geist_400Regular',
  '500': 'Geist_500Medium',
  '600': 'Geist_600SemiBold',
  '700': 'Geist_700Bold',
  '800': 'Geist_800ExtraBold',
  '900': 'Geist_900Black',
}

/** Texto con la tipografía de la web (Geist) y el color de texto del tema. */
export function Txt({ w = '400', size = 14, color, upper, track, style, ...rest }: TextProps & { w?: Weight; size?: number; color?: string; upper?: boolean; track?: number }) {
  const p = usePalette()
  const base: TextStyle = { fontFamily: FAMILY[w], fontSize: size, color: color ?? p.onSurface, ...(upper ? { textTransform: 'uppercase' as const } : null), ...(track !== undefined ? { letterSpacing: track } : null) }
  return <Text maxFontSizeMultiplier={1.2} {...rest} style={[base, style]} />
}

/** Etiqueta de sección: pequeña, en mayúsculas y con espaciado (como `text-xs uppercase font-bold tracking-wider`). */
export function Label({ children, color, style }: { children: ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  const p = usePalette()
  return <Txt w="700" size={12} upper track={1} color={color ?? p.onSurfaceVariant} style={style}>{children}</Txt>
}

export function Avatar({ id, name, uri, size = 32, border }: { id?: string | null; name?: string | null; uri?: string | null; size?: number; border?: boolean }) {
  const p = usePalette()
  const frame: ViewStyle = { width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: p.high, borderWidth: border ? 2 : StyleSheet.hairlineWidth, borderColor: alpha(p.outline, border ? 0.3 : 0.2) }
  if (uri) return <View style={frame}><Image source={imageSource(uri)} style={{ width: '100%', height: '100%' }} /></View>
  return (
    <View style={[frame, { backgroundColor: avatarColor(id), alignItems: 'center', justifyContent: 'center' }]}>
      <Txt w="700" size={Math.max(10, size * 0.4)} color="#fff">{initials(name)}</Txt>
    </View>
  )
}

export function IconBtn({ icon: Icon, onPress, label, size = 20, color, badge, tint, dimension = 44, style }: {
  icon: LucideIcon; onPress: () => void; label: string; size?: number; color?: string; badge?: ReactNode; tint?: boolean; dimension?: number; style?: StyleProp<ViewStyle>
}) {
  const p = usePalette()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [{ width: dimension, height: dimension, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? p.high : tint ? p.high : 'transparent' }, style]}
    >
      <Icon size={size} color={color ?? p.onSurface} />
      {badge}
    </Pressable>
  )
}

export function Btn({ label, onPress, variant = 'primary', loading, disabled, icon: Icon, style }: {
  label: string; onPress: () => void; variant?: 'primary' | 'outline' | 'ghost' | 'danger' | 'soft'; loading?: boolean; disabled?: boolean; icon?: LucideIcon; style?: StyleProp<ViewStyle>
}) {
  const p = usePalette()
  const colors = {
    primary: { bg: p.primary, fg: '#000000', border: p.primary },
    soft: { bg: alpha(p.primary, 0.2), fg: p.primary, border: alpha(p.primary, 0.3) },
    outline: { bg: 'transparent', fg: p.onSurface, border: alpha(p.outline, 0.3) },
    ghost: { bg: 'transparent', fg: p.onSurfaceVariant, border: 'transparent' },
    danger: { bg: alpha(p.error, 0.1), fg: p.error, border: alpha(p.error, 0.3) },
  }[variant]
  const off = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      style={({ pressed }) => [{ minHeight: TOUCH, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: off ? 0.5 : pressed ? 0.85 : 1 }, style]}
    >
      {loading ? <ActivityIndicator color={colors.fg} /> : Icon ? <Icon size={16} color={colors.fg} /> : null}
      {!loading && <Txt w="700" size={13} upper track={0.8} color={colors.fg}>{label}</Txt>}
    </Pressable>
  )
}

/** Campo de texto con el estilo de los formularios de la web. */
export function Field({ label, style, multiline, ...rest }: TextInputProps & { label?: string }) {
  const p = usePalette()
  const [focus, setFocus] = useState(false)
  return (
    <View style={{ gap: 6 }}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        maxFontSizeMultiplier={1.2}
        {...rest}
        multiline={multiline}
        onFocus={(e) => { setFocus(true); rest.onFocus?.(e) }}
        onBlur={(e) => { setFocus(false); rest.onBlur?.(e) }}
        placeholderTextColor={alpha(p.onSurfaceVariant, 0.6)}
        style={[{ minHeight: TOUCH, borderRadius: 12, borderWidth: 1, borderColor: focus ? p.primary : alpha(p.outline, 0.3), backgroundColor: p.container, color: p.onSurface, fontFamily: FAMILY['400'], fontSize: 16, paddingHorizontal: 16, paddingVertical: multiline ? 12 : 0, textAlignVertical: multiline ? 'top' : 'center' }, style]}
      />
    </View>
  )
}

export function Chip({ label, on, onPress, left }: { label: string; on?: boolean; onPress: () => void; left?: ReactNode }) {
  const p = usePalette()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      style={{ minHeight: 44, borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderColor: on ? p.primary : alpha(p.outline, 0.3), backgroundColor: on ? alpha(p.primary, 0.2) : 'transparent' }}
    >
      {left}
      <Txt w="600" size={14} color={on ? p.primary : p.onSurface}>{label}</Txt>
    </Pressable>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  const p = usePalette()
  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: alpha(p.outline, 0.3), padding: 32 }}>
      <Txt size={14} color={alpha(p.onSurface, 0.8)} style={{ textAlign: 'center' }}>{children}</Txt>
    </View>
  )
}

/* ------------------------------------------------------------------ Avisos (toast) */
type ToastKind = 'ok' | 'error'
const ToastCtx = createContext<(message: string, kind?: ToastKind) => void>(() => undefined)
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const p = usePalette()
  const [toast, setToast] = useState<{ message: string; kind: ToastKind } | null>(null)
  const opacity = useRef(new Animated.Value(0)).current
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((message: string, kind: ToastKind = 'ok') => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ message, kind })
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start()
    timer.current = setTimeout(() => Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null)), 3200)
  }, [opacity])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 110, opacity, zIndex: 999 }}>
          <View style={{ borderRadius: 14, borderWidth: 1, borderColor: toast.kind === 'error' ? alpha(p.error, 0.5) : alpha(p.outline, 0.4), backgroundColor: p.highest, paddingHorizontal: 16, paddingVertical: 12 }}>
            <Txt w="500" size={14} color={toast.kind === 'error' ? p.error : p.onSurface}>{toast.message}</Txt>
          </View>
        </Animated.View>
      )}
    </ToastCtx.Provider>
  )
}
