import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '@/lib/api'
import { TOUCH, useTheme } from '@/lib/theme'
import type { TaskStatus } from '@/lib/types'

export default function NewTask() {
  const t = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { teamId, status } = useLocalSearchParams<{ teamId: string; status?: TaskStatus }>()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSave = title.trim().length > 0 && !busy

  async function save() {
    if (!canSave) return
    setBusy(true)
    setError(null)
    try {
      const { id } = await api<{ id: string }>('POST', `/teams/${teamId}/tasks`, { title: title.trim(), description: description.trim() || null })
      // Las tareas nacen "pendientes"; si se creó desde otra pestaña, se coloca en ella.
      if (status && status !== 'pending') await api('POST', `/tasks/${id}/move`, { status })
      router.back()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const input = [styles.input, { backgroundColor: t.card, borderColor: t.border, color: t.text }]

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.background }}>
      <View style={{ padding: 16, paddingTop: Platform.OS === 'ios' ? 24 : insets.top + 8, gap: 12 }}>
        <Text style={{ color: t.text, fontSize: 24, fontWeight: '800' }}>Nueva tarea</Text>
        <TextInput style={input} value={title} onChangeText={setTitle} placeholder="Título" placeholderTextColor={t.textMuted} maxLength={200} autoFocus accessibilityLabel="Título" />
        <TextInput
          style={[...input, { minHeight: 120, textAlignVertical: 'top', paddingTop: 12 }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Descripción (opcional)"
          placeholderTextColor={t.textMuted}
          multiline
          maxLength={5000}
          accessibilityLabel="Descripción"
        />
        {error && <Text style={{ color: t.error }} accessibilityRole="alert">{error}</Text>}
        <View style={styles.actions}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" style={[styles.btn, { borderWidth: 1, borderColor: t.border }]}>
            <Text style={{ color: t.text, fontWeight: '700' }}>Cancelar</Text>
          </Pressable>
          <Pressable onPress={save} disabled={!canSave} accessibilityRole="button" style={[styles.btn, { backgroundColor: t.primary, opacity: canSave ? 1 : 0.5 }]}>
            {busy ? <ActivityIndicator color={t.onPrimary} /> : <Text style={{ color: t.onPrimary, fontWeight: '700' }}>Crear</Text>}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  input: { minHeight: TOUCH, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, fontSize: 16 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn: { flex: 1, minHeight: TOUCH, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
})
