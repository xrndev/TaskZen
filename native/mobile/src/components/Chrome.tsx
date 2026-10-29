import { ArrowLeft, Bell, CalendarDays, ChevronDown, LayoutGrid, List, Menu, Plus, Search, SlidersHorizontal, type LucideIcon } from 'lucide-react-native'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Profile, Task, Team } from '@domain/types'
import { fmtShort, parseDate, toMs } from '@/lib/dates'
import { alpha, usePalette } from '@/lib/theme'
import { useNow } from '@/lib/useNow'
import { BottomSheet } from './BottomSheet'
import { Avatar, IconBtn, Txt } from './ui'

export type MobileView = 'board' | 'list' | 'calendar'

const SOON_MS = 48 * 60 * 60 * 1000

/** Aviso dentro de la app: tareas abiertas asignadas a mí que vencieron o vencen en las próximas 48 horas. */
function DueSoonBell({ tasks, userId, onOpen }: { tasks: Task[]; userId: string; onOpen: (t: Task) => void }) {
  const p = usePalette()
  const now = useNow()
  const [open, setOpen] = useState(false)

  const due = useMemo(() => {
    const limit = now + SOON_MS
    return tasks
      .filter((t) => t.assigned_to === userId && t.status !== 'completed' && t.due_date && toMs(t.due_date) <= limit)
      .sort((a, b) => toMs(a.due_date) - toMs(b.due_date))
  }, [tasks, userId, now])
  const overdue = due.filter((t) => toMs(t.due_date) < now).length

  return (
    <>
      <IconBtn
        icon={Bell}
        label={`Vencimientos próximos: ${due.length}`}
        onPress={() => setOpen(true)}
        badge={due.length > 0 ? (
          <View style={{ position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: overdue ? p.error : p.primary }}>
            <Txt w="700" size={9} color={overdue ? '#fff' : '#000'}>{due.length}</Txt>
          </View>
        ) : undefined}
      />
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Tus tareas por vencer">
        {due.length === 0 ? (
          <Txt size={14} color={p.onSurfaceVariant} style={{ paddingVertical: 12 }}>Nada urgente por ahora.</Txt>
        ) : (
          <View style={{ gap: 4 }}>
            {due.map((t) => {
              const late = toMs(t.due_date) < now
              return (
                <Pressable key={t.id} onPress={() => { setOpen(false); onOpen(t) }} accessibilityRole="button" style={({ pressed }) => ({ borderRadius: 12, paddingHorizontal: 8, paddingVertical: 10, backgroundColor: pressed ? p.high : 'transparent' })}>
                  <Txt w="500" size={14} numberOfLines={1}>{t.title}</Txt>
                  <Txt size={12} w={late ? '600' : '400'} color={late ? p.error : p.onSurfaceVariant}>{late ? 'Vencida · ' : 'Vence · '}{fmtShort(parseDate(t.due_date)!)}</Txt>
                </Pressable>
              )
            })}
          </View>
        )}
      </BottomSheet>
    </>
  )
}

/** Cabecera compacta: una sola fila (dos mientras se busca). */
export function Header(props: {
  teams: Team[]
  teamId: string | null
  onTeamChange: (id: string) => void
  onNewTeam: () => void
  searchOpen: boolean
  onSearchOpen: (open: boolean) => void
  query: string
  onQuery: (q: string) => void
  filtersCount: number
  onFilters: () => void
  tasks: Task[]
  me: Profile
  onOpenTask: (t: Task) => void
  onProfile: () => void
}) {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  const input = useRef<React.ComponentRef<typeof TextInput>>(null)
  const [teamsOpen, setTeamsOpen] = useState(false)
  const team = props.teams.find((t) => t.id === props.teamId)

  useEffect(() => { if (props.searchOpen) input.current?.focus() }, [props.searchOpen])

  return (
    <View style={{ paddingTop: insets.top, paddingHorizontal: 12, borderBottomWidth: 1, borderColor: p.high, backgroundColor: alpha(p.surface, 0.95) }}>
      {props.searchOpen ? (
        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconBtn icon={ArrowLeft} label="Cerrar búsqueda" onPress={() => props.onSearchOpen(false)} />
          <TextInput
            ref={input}
            value={props.query}
            onChangeText={props.onQuery}
            placeholder="Buscar tareas"
            placeholderTextColor={alpha(p.onSurface, 0.6)}
            returnKeyType="search"
            accessibilityLabel="Buscar tareas"
            style={{ flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: alpha(p.outline, 0.3), backgroundColor: p.low, paddingHorizontal: 16, color: p.onSurface, fontFamily: 'Geist_400Regular', fontSize: 16 }}
          />
        </View>
      ) : (
        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Pressable onPress={() => setTeamsOpen(true)} accessibilityRole="button" accessibilityLabel="Equipo" style={{ flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 }}>
            <Txt w="700" size={15} numberOfLines={1} style={{ flexShrink: 1 }}>{team?.name ?? 'Serenboard'}</Txt>
            <ChevronDown size={16} color={p.onSurfaceVariant} />
          </Pressable>
          <IconBtn
            icon={Search}
            label="Buscar"
            onPress={() => props.onSearchOpen(true)}
            badge={props.query ? <View style={{ position: 'absolute', top: 8, right: 8, width: 10, height: 10, borderRadius: 5, backgroundColor: p.primary }} /> : undefined}
          />
          <IconBtn
            icon={SlidersHorizontal}
            label={props.filtersCount ? `Filtros, ${props.filtersCount} activos` : 'Filtros'}
            onPress={props.onFilters}
            badge={props.filtersCount > 0 ? (
              <View style={{ position: 'absolute', top: 2, right: 2, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: p.primary }}>
                <Txt w="900" size={11} color="#000">{props.filtersCount}</Txt>
              </View>
            ) : undefined}
          />
          <DueSoonBell tasks={props.tasks} userId={props.me.id} onOpen={props.onOpenTask} />
          <Pressable onPress={props.onProfile} accessibilityRole="button" accessibilityLabel="Mi perfil" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Avatar id={props.me.id} name={props.me.full_name} uri={props.me.avatar_url} size={36} border />
          </Pressable>
        </View>
      )}

      <BottomSheet open={teamsOpen} onClose={() => setTeamsOpen(false)} title="Equipos">
        <View style={{ gap: 4 }}>
          {props.teams.map((t) => {
            const on = t.id === props.teamId
            return (
              <Pressable key={t.id} onPress={() => { setTeamsOpen(false); props.onTeamChange(t.id) }} accessibilityRole="button" style={({ pressed }) => ({ minHeight: 48, justifyContent: 'center', borderRadius: 12, paddingHorizontal: 12, backgroundColor: on ? alpha(p.primary, 0.2) : pressed ? p.high : 'transparent' })}>
                <Txt w={on ? '700' : '500'} size={16} color={on ? p.primary : p.onSurface}>{t.name}</Txt>
              </Pressable>
            )
          })}
          <Pressable onPress={() => { setTeamsOpen(false); props.onNewTeam() }} accessibilityRole="button" style={({ pressed }) => ({ minHeight: 48, justifyContent: 'center', borderRadius: 12, paddingHorizontal: 12, backgroundColor: pressed ? p.high : 'transparent' })}>
            <Txt w="600" size={16} color={p.primary}>+ Nuevo equipo</Txt>
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  )
}

const NAV: { id: MobileView | 'more'; label: string; icon: LucideIcon }[] = [
  { id: 'board', label: 'Tablero', icon: LayoutGrid },
  { id: 'list', label: 'Lista', icon: List },
  { id: 'calendar', label: 'Calendario', icon: CalendarDays },
  { id: 'more', label: 'Más', icon: Menu },
]

/** Navegación inferior (zona del pulgar) y botón flotante de nueva tarea. */
export function BottomNav({ view, onView, onMore, onNewTask }: { view: MobileView; onView: (v: MobileView) => void; onMore: () => void; onNewTask: () => void }) {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  return (
    <>
      <Pressable
        onPress={onNewTask}
        accessibilityRole="button"
        accessibilityLabel="Nueva tarea"
        style={({ pressed }) => ({ position: 'absolute', right: 16, bottom: 80 + insets.bottom, width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: p.primary, elevation: 8, shadowColor: p.primary, shadowOpacity: 0.3, shadowRadius: 12, transform: [{ scale: pressed ? 0.95 : 1 }] })}
      >
        <Plus size={28} color="#000" />
      </Pressable>

      <View accessibilityRole="tablist" style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: p.high, backgroundColor: alpha(p.surface, 0.95), paddingBottom: insets.bottom }}>
        {NAV.map(({ id, label, icon: Icon }) => {
          const on = id === view
          return (
            <Pressable key={id} onPress={() => (id === 'more' ? onMore() : onView(id))} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <View style={{ width: 56, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? alpha(p.primary, 0.2) : 'transparent' }}>
                <Icon size={20} color={on ? p.primary : alpha(p.onSurface, 0.8)} />
              </View>
              <Txt w="600" size={12} color={on ? p.primary : alpha(p.onSurface, 0.8)}>{label}</Txt>
            </Pressable>
          )
        })}
      </View>
    </>
  )
}
