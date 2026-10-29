import * as SecureStore from 'expo-secure-store'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import type { Tag, Task, TaskStatus, Team, TeamMember, TeamRole } from '@domain/types'
import { apiClient, type TaskInput } from './client'

const TEAM_KEY = 'serenboard.team'
const POLL_MS = 20_000

/**
 * Estado del tablero: equipos, miembros, etiquetas y tareas del equipo activo. Es el equivalente móvil del estado de
 * `KanbanBoard.tsx` de la web. La web recibe los cambios por SSE; aquí se refresca cada 20 s mientras la app está abierta.
 */
export function useBoard(userId: string) {
  const [teams, setTeams] = useState<Team[]>([])
  const [teamId, setTeamId] = useState<string | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const teamRef = useRef<string | null>(null)

  const loadTeam = useCallback(async (id: string) => {
    const [t, m, g] = await Promise.all([apiClient.tasks(id), apiClient.members(id), apiClient.tags(id)])
    if (teamRef.current !== id) return // se cambió de equipo mientras tanto
    setTasks(t); setMembers(m); setTags(g)
  }, [])

  /** Carga equipos y, del equipo activo, tareas, miembros y etiquetas. `preferred` fuerza un equipo. */
  const load = useCallback(async (preferred?: string | null) => {
    try {
      setError(null)
      const list = await apiClient.teams()
      setTeams(list)
      const saved = preferred ?? teamRef.current ?? (await SecureStore.getItemAsync(TEAM_KEY))
      const current = list.find((x) => x.id === saved) ?? list[0]
      if (!current) { setTasks([]); return }
      teamRef.current = current.id
      setTeamId(current.id)
      await loadTeam(current.id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [loadTeam])

  useEffect(() => { void load() }, [load])

  // Refresco periódico solo con la app en primer plano.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    const start = () => { timer = setInterval(() => { if (teamRef.current) void loadTeam(teamRef.current).catch(() => undefined) }, POLL_MS) }
    const stop = () => { if (timer) clearInterval(timer); timer = null }
    start()
    const sub = AppState.addEventListener('change', (s) => {
      stop()
      if (s === 'active') { start(); if (teamRef.current) void loadTeam(teamRef.current).catch(() => undefined) }
    })
    return () => { stop(); sub.remove() }
  }, [loadTeam])

  const refresh = useCallback(async () => {
    if (teamRef.current) await loadTeam(teamRef.current).catch((e) => setError((e as Error).message))
  }, [loadTeam])

  const pullToRefresh = useCallback(() => { setRefreshing(true); void load() }, [load])

  const switchTeam = useCallback(async (id: string) => {
    teamRef.current = id
    setTeamId(id); setLoading(true); setTasks([]); setTags([]); setMembers([])
    await SecureStore.setItemAsync(TEAM_KEY, id).catch(() => undefined)
    try { await loadTeam(id) } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }, [loadTeam])

  const role: TeamRole = members.find((m) => m.user_id === userId)?.role ?? 'member'

  const createTask = useCallback(async (input: TaskInput) => {
    if (!teamRef.current) return
    await apiClient.createTask(teamRef.current, input)
    await refresh()
  }, [refresh])

  const updateTask = useCallback(async (id: string, patch: Partial<TaskInput>) => {
    await apiClient.updateTask(id, patch)
    await refresh()
  }, [refresh])

  /** Mueve al final de la columna de destino (la alternativa móvil a arrastrar), con efecto inmediato. */
  const moveTask = useCallback(async (task: Task, status: TaskStatus) => {
    const last = tasks.filter((t) => t.status === status && t.id !== task.id).at(-1)
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)))
    try {
      await apiClient.moveTask(task.id, { status, prevId: last?.id ?? null, nextId: null })
    } catch (e) {
      setError((e as Error).message)
      await refresh() // el servidor lo rechazó: se vuelve al estado real
      throw e
    }
  }, [tasks, refresh])

  const deleteTask = useCallback(async (id: string) => {
    await apiClient.deleteTask(id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return {
    teams, setTeams, teamId, members, setMembers, tags, setTags, tasks, role, loading, refreshing, error,
    switchTeam, refresh, pullToRefresh, createTask, updateTask, moveTask, deleteTask,
    team: teams.find((t) => t.id === teamId) ?? null,
  }
}
