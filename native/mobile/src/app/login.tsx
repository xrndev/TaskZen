import { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '@/lib/api'
import { useSession, type Provider } from '@/lib/session'
import { TOUCH, useTheme } from '@/lib/theme'

const PROVIDER_LABEL: Record<Provider, string> = { google: 'Google', microsoft: 'Microsoft (Outlook)', github: 'GitHub' }

export default function Login() {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const { signIn, signInWith } = useSession()
  const [providers, setProviders] = useState<Provider[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Los mismos proveedores que tiene configurados el servidor (los de la web).
  useEffect(() => {
    api<Provider[]>('GET', '/auth/providers').then(setProviders).catch(() => undefined)
  }, [])

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy

  async function submit() {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  async function viaProvider(p: Provider) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await signInWith(p)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const input = [styles.input, { backgroundColor: t.card, borderColor: t.border, color: t.text }]

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.background }}>
      <View style={[styles.wrap, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
        <Text style={[styles.brand, { color: t.primary }]}>TaskZen</Text>
        <Text style={[styles.sub, { color: t.textMuted }]}>Inicia sesión para ver tus tareas.</Text>

        {providers.map((p) => (
          <Pressable
            key={p}
            onPress={() => viaProvider(p)}
            disabled={busy}
            accessibilityRole="button"
            style={[styles.provider, { borderColor: t.border, backgroundColor: t.card, opacity: busy ? 0.5 : 1 }]}
          >
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>Continuar con {PROVIDER_LABEL[p]}</Text>
          </Pressable>
        ))}
        {providers.length > 0 && <Text style={{ color: t.textMuted, textAlign: 'center', marginVertical: 4 }}>o con tu correo</Text>}

        <TextInput
          style={input}
          value={email}
          onChangeText={setEmail}
          placeholder="Correo"
          placeholderTextColor={t.textMuted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
          accessibilityLabel="Correo electrónico"
        />
        <TextInput
          style={input}
          value={password}
          onChangeText={setPassword}
          placeholder="Contraseña"
          placeholderTextColor={t.textMuted}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
          accessibilityLabel="Contraseña"
        />

        {error && <Text style={[styles.error, { color: t.error }]} accessibilityRole="alert">{error}</Text>}

        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          accessibilityRole="button"
          style={[styles.button, { backgroundColor: t.primary, opacity: canSubmit ? 1 : 0.5 }]}
        >
          {busy ? <ActivityIndicator color={t.onPrimary} /> : <Text style={[styles.buttonText, { color: t.onPrimary }]}>Entrar</Text>}
        </Pressable>

        <Text style={[styles.hint, { color: t.textMuted }]}>El registro es solo por invitación. Si es tu primera vez, abre primero el enlace que te enviaron.</Text>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 24, gap: 12 },
  brand: { fontSize: 36, fontWeight: '800' },
  sub: { fontSize: 16, marginBottom: 16 },
  input: { minHeight: TOUCH, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, fontSize: 16 },
  provider: { minHeight: TOUCH, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  button: { minHeight: TOUCH, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  error: { fontSize: 14 },
  hint: { fontSize: 13, lineHeight: 19, marginTop: 16 },
})
