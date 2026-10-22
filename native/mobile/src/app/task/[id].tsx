import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { formatDue } from '@/components/TaskCard'
import { api } from '@/lib/api'
import { TOUCH, useTheme } from '@/lib/theme'
import { STATUSES, type Task, type TaskComment, type TaskStatus } from '@/lib/types'

export default function TaskDetail() {
  const t = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { id, teamId } = useLocalSearchParams<{ id: string; teamId: string }>()

  const [task, setTask] = useState<Task | null>(null)
  const [comments, setComments] = useState<TaskComment[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [tasks, list] = await Promise.all([
        api<Task[]>('GET', `/teams/${teamId}/tasks`),
        api<TaskComment[]>('GET', `/tasks/${id}/comments`),
      ])
      const found = tasks.find((x) => x.id === id)
      if (!found) return router.back()
      setTask(found)
      setComments(list)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [id, teamId, router])

  useEffect(() => { void load() }, [load])

  async function changeStatus(status: TaskStatus) {
    if (!task || task.status === status || busy) return
    setBusy(true)
    try {
      // Al final de la columna de destino: detrás de la última tarea de ese estado.
      const siblings = (await api<Task[]>('GET', `/teams/${teamId}/tasks`)).filter((x) => x.status === status && x.id !== task.id)
      await api('POST', `/tasks/${task.id}/move`, { status, prevId: siblings.at(-1)?.id ?? null })
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function sendComment() {
    const content = draft.trim()
    if (!content || busy) return
    setBusy(true)
    try {
      await api('POST', `/tasks/${id}/comments`, { content })
      setDraft('')
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function confirmDelete() {
    Alert.alert('Borrar tarea', 'Se borrará con sus comentarios y adjuntos. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api('DELETE', `/tasks/${id}`)
            router.back()
          } catch (e) {
            setError((e as Error).message)
          }
        },
      },
    ])
  }

  if (!task) {
    return (
      <View style={[styles.center, { backgroundColor: t.background }]}>
        {error ? <Text style={{ color: t.error }}>{error}</Text> : <ActivityIndicator color={t.primary} size="large" />}
      </View>
    )
  }

  const overdue = !!task.due_date && task.status !== 'completed' && Date.parse(task.due_date) < Date.now()

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.background }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: 8 }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver" style={styles.back}>
          <Text style={{ color: t.primary, fontSize: 16, fontWeight: '600' }}>‹ Volver</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: t.text }]}>{task.title}</Text>
        {!!task.description && <Text style={{ color: t.text, fontSize: 16, lineHeight: 24 }}>{task.description}</Text>}

        <View style={styles.statusRow} accessibilityRole="radiogroup">
          {STATUSES.map((s) => {
            const active = s.key === task.status
            return (
              <Pressable
                key={s.key}
                onPress={() => changeStatus(s.key)}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                style={[styles.statusBtn, { borderColor: active ? t.primary : t.border, backgroundColor: active ? t.primary : 'transparent' }]}
              >
                <Text style={{ color: active ? t.onPrimary : t.text, fontWeight: '700', fontSize: 14 }}>{s.label}</Text>
              </Pressable>
            )
          })}
        </View>

        {!!task.due_date && (
          <Text style={{ color: overdue ? t.error : t.textMuted, fontSize: 15, fontWeight: overdue ? '700' : '400' }}>
            {overdue ? 'Vencida · ' : 'Vence · '}{formatDue(task.due_date)}
          </Text>
        )}
        {!!task.assignee?.full_name && <Text style={{ color: t.textMuted, fontSize: 15 }}>Asignada a {task.assignee.full_name}</Text>}

        {!!task.tags?.length && (
          <View style={styles.tags}>
            {task.tags.map((tag) => (
              <View key={tag.id} style={[styles.tag, { borderColor: tag.color }]}><Text style={{ color: tag.color, fontSize: 13, fontWeight: '600' }}>{tag.name}</Text></View>
            ))}
          </View>
        )}

        {error && <Text style={{ color: t.error }} accessibilityRole="alert">{error}</Text>}

        <Text style={[styles.section, { color: t.textMuted }]}>Comentarios · {comments.length}</Text>
        {comments.map((c) => (
          <View key={c.id} style={[styles.comment, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={{ color: t.textMuted, fontSize: 13, fontWeight: '700' }}>{c.profile?.full_name ?? 'Alguien'}</Text>
            <Text style={{ color: t.text, fontSize: 15, lineHeight: 22 }}>{c.content}</Text>
          </View>
        ))}

        <Pressable onPress={confirmDelete} accessibilityRole="button" style={[styles.delete, { borderColor: t.error }]}>
          <Text style={{ color: t.error, fontWeight: '700' }}>Borrar tarea</Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.composer, { borderColor: t.border, backgroundColor: t.background, paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={[styles.input, { backgroundColor: t.card, borderColor: t.border, color: t.text }]}
          value={draft}
          onChangeText={setDraft}
          placeholder="Escribe un comentario"
          placeholderTextColor={t.textMuted}
          multiline
          maxLength={5000}
          accessibilityLabel="Nuevo comentario"
        />
        <Pressable
          onPress={sendComment}
          disabled={!draft.trim() || busy}
          accessibilityRole="button"
          accessibilityLabel="Enviar comentario"
          style={[styles.send, { backgroundColor: t.primary, opacity: !draft.trim() || busy ? 0.5 : 1 }]}
        >
          <Text style={{ color: t.onPrimary, fontWeight: '700' }}>Enviar</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  back: { minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: 8, alignSelf: 'flex-start' },
  title: { fontSize: 26, fontWeight: '800', lineHeight: 32 },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusBtn: { flex: 1, minHeight: TOUCH, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  section: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginTop: 8 },
  comment: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, gap: 4 },
  delete: { minHeight: TOUCH, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  composer: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: TOUCH, maxHeight: 120, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 },
  send: { minHeight: TOUCH, paddingHorizontal: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
})
