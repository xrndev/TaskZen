import { useFocusEffect, useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { useCallback, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TaskCard } from '@/components/TaskCard'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'
import { TOUCH, useTheme } from '@/lib/theme'
import { STATUSES, type Task, type TaskStatus, type Team } from '@/lib/types'

const TEAM_KEY = 'taskzen.team'

export default function Board() {
  const t = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { signOut } = useSession()

  const [teams, setTeams] = useState<Team[]>([])
  const [teamId, setTeamId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [status, setStatus] = useState<TaskStatus>('pending')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  // Refs para que `load` tenga identidad estable y useFocusEffect no se dispare en bucle.
  const teamsRef = useRef<Team[]>([])
  const teamIdRef = useRef<string | null>(null)

  const load = useCallback(async (preferred?: string | null) => {
    try {
      setError(null)
      const list = teamsRef.current.length ? teamsRef.current : await api<Team[]>('GET', '/teams')
      teamsRef.current = list
      setTeams(list)
      const saved = preferred ?? teamIdRef.current ?? (await SecureStore.getItemAsync(TEAM_KEY))
      const current = list.find((x) => x.id === saved) ?? list[0]
      if (!current) return setTasks([])
      teamIdRef.current = current.id
      setTeamId(current.id)
      setTasks(await api<Task[]>('GET', `/teams/${current.id}/tasks`))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Al volver de una tarea (creada, movida, borrada) se recarga.
  useFocusEffect(useCallback(() => { void load() }, [load]))

  const counts = useMemo(() => {
    const c: Record<TaskStatus, number> = { pending: 0, in_progress: 0, completed: 0 }
    for (const x of tasks) c[x.status]++
    return c
  }, [tasks])
  const visible = useMemo(() => tasks.filter((x) => x.status === status), [tasks, status])
  const team = teams.find((x) => x.id === teamId)
  const now = Date.now()

  async function pickTeam(id: string) {
    setMenu(false)
    setLoading(true)
    await SecureStore.setItemAsync(TEAM_KEY, id)
    void load(id)
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.background, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Pressable onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="Cambiar de equipo o cerrar sesión" style={styles.teamBtn}>
          <Text style={[styles.teamName, { color: t.text }]} numberOfLines={1}>{team?.name ?? 'TaskZen'}</Text>
          <Text style={{ color: t.textMuted, fontSize: 14 }}>  ▾</Text>
        </Pressable>
      </View>

      <View style={[styles.tabs, { borderColor: t.border }]} accessibilityRole="tablist">
        {STATUSES.map((s) => {
          const active = s.key === status
          return (
            <Pressable
              key={s.key}
              onPress={() => setStatus(s.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tab, active && { borderBottomColor: t.primary }]}
            >
              <Text style={{ color: active ? t.primary : t.textMuted, fontWeight: '700', fontSize: 15 }}>{s.label} · {counts[s.key]}</Text>
            </Pressable>
          )
        })}
      </View>

      {loading ? (
        <ActivityIndicator color={t.primary} size="large" style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(x) => x.id}
          renderItem={({ item }) => <TaskCard task={item} now={now} onPress={(x) => router.push({ pathname: '/task/[id]', params: { id: x.id, teamId: teamId! } })} />}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 96 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load() }} tintColor={t.primary} />}
          ListEmptyComponent={
            <Text style={{ color: error ? t.error : t.textMuted, textAlign: 'center', marginTop: 48, fontSize: 15 }}>
              {error ?? 'No hay tareas aquí.'}
            </Text>
          }
        />
      )}

      {!!teamId && (
        <Pressable
          onPress={() => router.push({ pathname: '/new-task', params: { teamId, status } })}
          accessibilityRole="button"
          accessibilityLabel="Nueva tarea"
          style={[styles.fab, { backgroundColor: t.primary, bottom: insets.bottom + 20 }]}
        >
          <Text style={{ color: t.onPrimary, fontSize: 30, lineHeight: 34, fontWeight: '500' }}>+</Text>
        </Pressable>
      )}

      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenu(false)} accessibilityLabel="Cerrar menú" />
        <View style={[styles.sheet, { backgroundColor: t.card, paddingBottom: insets.bottom + 12 }]}>
          <Text style={[styles.sheetTitle, { color: t.textMuted }]}>Equipos</Text>
          {teams.map((x) => (
            <Pressable key={x.id} onPress={() => pickTeam(x.id)} accessibilityRole="button" style={styles.row}>
              <Text style={{ color: x.id === teamId ? t.primary : t.text, fontSize: 16, fontWeight: x.id === teamId ? '700' : '400' }}>{x.name}</Text>
            </Pressable>
          ))}
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginVertical: 8 }} />
          <Pressable onPress={() => { setMenu(false); void signOut() }} accessibilityRole="button" style={styles.row}>
            <Text style={{ color: t.error, fontSize: 16 }}>Cerrar sesión</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 8 },
  teamBtn: { minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  teamName: { fontSize: 24, fontWeight: '800', maxWidth: 300 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: TOUCH, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  fab: { position: 'absolute', right: 20, width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  backdrop: { flex: 1, backgroundColor: '#00000088' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, paddingHorizontal: 20 },
  sheetTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  row: { minHeight: TOUCH, justifyContent: 'center' },
})
