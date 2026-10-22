import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Task, TaskStatus } from '@domain/types'
import { CalendarView } from '@/components/Calendar'
import { BottomNav, Header, type MobileView } from '@/components/Chrome'
import { NewTask, type NewTaskData } from '@/components/NewTask'
import { ProfileSheet } from '@/components/ProfileSheet'
import { countFilters, FiltersSheet, MoreSheet, NO_FILTERS, type Filters } from '@/components/Sheets'
import { TaskDetail } from '@/components/TaskDetail'
import { Board, TaskList } from '@/components/TaskViews'
import { CreateTeamSheet, TeamSettingsSheet } from '@/components/TeamSheets'
import { TagPicker } from '@/components/FormParts'
import { Txt, useToast } from '@/components/ui'
import { useBoard } from '@/lib/board'
import { fromDateInput } from '@/components/DateField'
import { parseDate } from '@/lib/dates'
import { usePushLifecycle } from '@/lib/push'
import { useSession, useUser } from '@/lib/session'
import { usePalette } from '@/lib/theme'

/** Pantalla principal: cabecera, vista activa (tablero, lista o calendario), navegación inferior y las hojas. */
export default function Home() {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { signOut, updateUser } = useSession()
  const me = useUser()
  const b = useBoard(me.id)

  const [view, setView] = useState<MobileView>('board')
  const [groupBy, setGroupBy] = useState<'status' | 'tag'>('status')
  const [activeStatus, setActiveStatus] = useState<TaskStatus>('pending')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)

  const [selected, setSelected] = useState<Task | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [teamOpen, setTeamOpen] = useState(false)
  const [createTeamOpen, setCreateTeamOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)

  // Tocar un aviso abre su tarea (cuando el tablero ya la ha cargado).
  const [pendingTask, setPendingTask] = useState<string | null>(null)
  usePushLifecycle(setPendingTask)
  useEffect(() => {
    if (!pendingTask) return
    const t = b.tasks.find((x) => x.id === pendingTask)
    if (t) { setSelected(t); setPendingTask(null) }
  }, [pendingTask, b.tasks])

  // El detalle abierto refleja siempre la última versión de la tarea (tras editar o refrescar).
  const current = selected ? b.tasks.find((t) => t.id === selected.id) ?? null : null

  // Filtros compartidos por todas las vistas (los mismos que en la web).
  const visible = useMemo(() => {
    const q = query.toLowerCase()
    const start = filters.range.start ? fromDateInput(filters.range.start) : null
    const end = filters.range.end ? fromDateInput(filters.range.end) : null
    return b.tasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q) && !(t.description?.toLowerCase() ?? '').includes(q)) return false
      if (filters.tagIds.length && !t.tags?.some((x) => filters.tagIds.includes(x.id))) return false
      if (filters.assigneeId && t.assigned_to !== filters.assigneeId) return false
      if (start || end) {
        const d = parseDate(t.due_date)
        if (!d) return false
        const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
        if (start && day < start) return false
        if (end && day > end) return false
      }
      return true
    })
  }, [b.tasks, query, filters])

  const guard = (fn: () => Promise<unknown>) => async () => { try { await fn() } catch (e) { toast((e as Error).message, 'error') } }
  const onMove = (t: Task, s: TaskStatus) => { setActiveStatus(s); return b.moveTask(t, s).catch((e) => toast((e as Error).message, 'error')) }
  const onDelete = async (id: string) => { await b.deleteTask(id); setSelected((s) => (s?.id === id ? null : s)) }
  const onCreate = async (d: NewTaskData) => b.createTask(d)

  const bottomInset = 160
  const refreshControl = <RefreshControl refreshing={b.refreshing} onRefresh={b.pullToRefresh} tintColor={p.primary} colors={[p.primary]} progressBackgroundColor={p.container} />

  const shared = {
    tasks: visible,
    userId: me.id,
    role: b.role,
    onOpen: setSelected,
    onMove,
    onDelete: (t: Task) => guard(() => onDelete(t.id))(),
    bottomInset,
    refreshControl,
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.background }}>
      <Header
        teams={b.teams}
        teamId={b.teamId}
        onTeamChange={b.switchTeam}
        onNewTeam={() => setCreateTeamOpen(true)}
        searchOpen={searchOpen}
        onSearchOpen={setSearchOpen}
        query={query}
        onQuery={setQuery}
        filtersCount={countFilters(filters)}
        onFilters={() => setFiltersOpen(true)}
        tasks={b.tasks}
        me={me}
        onOpenTask={setSelected}
        onProfile={() => setProfileOpen(true)}
      />

      {b.loading ? (
        <ActivityIndicator color={p.primary} size="large" style={{ marginTop: 48 }} />
      ) : b.error && b.tasks.length === 0 ? (
        <Txt color={p.error} style={{ textAlign: 'center', marginTop: 48, paddingHorizontal: 24 }}>{b.error}</Txt>
      ) : view === 'board' ? (
        <Board {...shared} groupBy={groupBy} allTags={b.tags} activeStatus={activeStatus} onActiveStatus={setActiveStatus} />
      ) : view === 'list' ? (
        <TaskList {...shared} />
      ) : (
        <CalendarView tasks={visible} onOpen={setSelected} bottomInset={bottomInset} refreshControl={refreshControl} />
      )}

      <BottomNav view={view} onView={setView} onMore={() => setMoreOpen(true)} onNewTask={() => setNewOpen(true)} />

      <FiltersSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} groupBy={groupBy} onGroupBy={setGroupBy} showGroupBy={view === 'board'} members={b.members} tags={b.tags} filters={filters} onFilters={setFilters} />
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        isAdmin={b.role === 'admin'}
        teamName={b.team?.name ?? null}
        onTeamSettings={() => setTeamOpen(true)}
        onNewTeam={() => setCreateTeamOpen(true)}
        onTags={() => setTagsOpen(true)}
        onProfile={() => setProfileOpen(true)}
        onLogout={() => void signOut()}
      />

      <TaskDetail
        task={current}
        teamId={b.teamId}
        members={b.members}
        tags={b.tags}
        role={b.role}
        userId={me.id}
        onClose={() => setSelected(null)}
        onUpdate={(id, patch) => b.updateTask(id, patch)}
        onMove={(t, s) => onMove(t, s)}
        onDelete={onDelete}
        onRefresh={b.refresh}
        onTagCreated={(tag) => b.setTags((prev) => [...prev, tag])}
      />
      <NewTask open={newOpen} onClose={() => setNewOpen(false)} onSubmit={onCreate} members={b.members} tags={b.tags} teamId={b.teamId} onTagCreated={(tag) => b.setTags((prev) => [...prev, tag])} />
      <TagPicker title="Categorías" open={tagsOpen} onClose={() => { setTagsOpen(false); void b.refresh() }} tags={b.tags} teamId={b.teamId} selected={[]} onChange={() => undefined} onCreated={(tag) => b.setTags((prev) => [...prev, tag])} />
      <CreateTeamSheet open={createTeamOpen} onClose={() => setCreateTeamOpen(false)} onCreated={(team) => { b.setTeams((prev) => [...prev, team]); void b.switchTeam(team.id) }} />
      <TeamSettingsSheet open={teamOpen} onClose={() => setTeamOpen(false)} team={b.team} role={b.role} onMembers={b.setMembers} onDeleted={() => void b.switchTeam(b.teams.find((t) => t.id !== b.teamId)?.id ?? '')} />
      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} profile={me} onUpdated={updateUser} onLogout={() => void signOut()} />
      <View pointerEvents="none" style={{ height: insets.bottom * 0 }} />
    </View>
  )
}
