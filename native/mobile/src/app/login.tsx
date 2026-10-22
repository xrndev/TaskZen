import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Btn, Field, Txt } from '@/components/ui'
import { apiClient } from '@/lib/client'
import { useSession, type Provider } from '@/lib/session'
import { alpha, usePalette } from '@/lib/theme'

const PROVIDER_LABEL: Record<Provider, string> = { google: 'Google', microsoft: 'Microsoft (Outlook)', github: 'GitHub' }

export default function Login() {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  const { signIn, signInWith } = useSession()
  const [providers, setProviders] = useState<Provider[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Los mismos proveedores que tiene configurados el servidor (los de la web).
  useEffect(() => {
    apiClient.providers().then((list) => setProviders(list as Provider[])).catch(() => undefined)
  }, [])

  const run = async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try { await fn() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const canSubmit = email.trim().length > 0 && password.length > 0

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: p.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
        <View style={{ gap: 12 }}>
          <Txt w="800" size={36} color={p.primary}>TaskZen</Txt>
          <Txt size={16} color={p.onSurfaceVariant} style={{ marginBottom: 12 }}>Organiza tus proyectos con paz y fluidez.</Txt>

          {providers.map((id) => (
            <Pressable key={id} onPress={() => run(() => signInWith(id))} disabled={busy} accessibilityRole="button" style={({ pressed }) => ({ minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: alpha(p.outline, 0.3), backgroundColor: pressed ? p.high : p.container, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.5 : 1 })}>
              <Txt w="600" size={16}>Continuar con {PROVIDER_LABEL[id]}</Txt>
            </Pressable>
          ))}
          {providers.length > 0 && <Txt size={14} color={p.onSurfaceVariant} style={{ textAlign: 'center', marginVertical: 4 }}>o con tu correo</Txt>}

          <Field value={email} onChangeText={setEmail} placeholder="Correo" autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" accessibilityLabel="Correo electrónico" />
          <Field value={password} onChangeText={setPassword} placeholder="Contraseña" secureTextEntry autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={() => canSubmit && run(() => signIn(email.trim(), password))} accessibilityLabel="Contraseña" />

          {error && <Txt size={14} color={p.error} accessibilityRole="alert">{error}</Txt>}

          <Btn label="Entrar" onPress={() => run(() => signIn(email.trim(), password))} loading={busy} disabled={!canSubmit} style={{ minHeight: 52 }} />

          <Txt size={13} color={p.onSurfaceVariant} style={{ lineHeight: 19, marginTop: 12 }}>El registro es solo por invitación. Si es tu primera vez, abre primero el enlace que te enviaron.</Txt>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
