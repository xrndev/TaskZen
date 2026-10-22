import { X } from 'lucide-react-native'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, Dimensions, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { alpha, usePalette } from '@/lib/theme'
import { IconBtn, Txt } from './ui'

/**
 * Hoja que sube desde abajo (patrón móvil), igual que la de la web: fondo difuminado, esquinas de 24,
 * asa y título. Se cierra tocando fuera, con el botón o con el gesto "atrás" de Android.
 */
export function BottomSheet({ open, onClose, title, children, scroll = true }: { open: boolean; onClose: () => void; title: string; children: ReactNode; scroll?: boolean }) {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  const [mounted, setMounted] = useState(open)
  const progress = useRef(new Animated.Value(0)).current
  const height = Dimensions.get('window').height

  useEffect(() => {
    if (open) {
      setMounted(true)
      Animated.timing(progress, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
    } else if (mounted) {
      Animated.timing(progress, { toValue: 0, duration: 160, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => setMounted(false))
    }
  }, [open, mounted, progress])

  if (!mounted) return null

  const body = <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>{children}</View>

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: progress, backgroundColor: alpha(p.background, 0.7) }}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Cerrar" />
        </Animated.View>
        <Animated.View
          style={{
            maxHeight: height * 0.88,
            backgroundColor: p.low,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderTopWidth: 1,
            borderColor: alpha(p.outline, 0.2),
            paddingBottom: Math.max(16, insets.bottom),
            transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height * 0.5, 0] }) }],
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: alpha(p.outline, 0.4) }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 12, paddingTop: 4, paddingBottom: 8 }}>
            <Txt w="700" size={16} numberOfLines={1} style={{ flex: 1, paddingRight: 8 }}>{title}</Txt>
            <IconBtn icon={X} label="Cerrar" onPress={onClose} color={p.onSurfaceVariant} />
          </View>
          {scroll ? <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>{body}</ScrollView> : body}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
