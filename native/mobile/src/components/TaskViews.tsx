import { ArrowRight, Calendar, ExternalLink, MessageSquare, MoreVertical, Paperclip, Trash2 } from 'lucide-react-native'
import { memo, useMemo, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { can } from '@domain/lib/permissions'
import type { Tag, Task, TaskStatus, TeamRole } from '@domain/types'
import { fmtShort, parseDate, toMs } from '@/lib/dates'
import { alpha, usePalette, type Palette } from '@/lib/theme'
import { useNow } from '@/lib/useNow'
import { BottomSheet } from './BottomSheet'
import { Avatar, Btn, Empty, Txt } from './ui'

export const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'completed']
export const STATUS_LABEL: Record<TaskStatus, string> = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed' }
export const STATUS_NAME: Record<TaskStatus, string> = { pending: 'Pendientes', in_progress: 'En curso', completed: 'Hechas' }

export const statusColor = (p: Palette, s: TaskStatus) => (s === 'pending' ? p.secondary : s === 'in_progress' ? p.primary : p.tertiary)

/** Etiqueta con el color de la propia tag: fondo 8 %, borde 19 % (como `TagBadge` de la web). */
export function TagBadge({ tag }: { tag: Pick<Tag, 'name' | 'color'> }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: alpha(tag.color, 0.08), borderColor: alpha(tag.color, 0.19) }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tag.color }} />
      <Txt w="700" size={10} upper track={1} color={tag.color}>{tag.name}</Txt>
    </View>
  )
}

export const TaskCard = memo(function TaskCard({ task, now, showStatus, onOpen, onMenu }: { task: Task; now: number; showStatus?: boolean; onOpen: (t: Task) => void; onMenu: (t: Task) => void }) {
  const p = usePalette()
  const due = parseDate(task.due_date)
  const overdue = !!due && task.status !== 'completed' && due.getTime() < now
  const done = task.status === 'completed'
  const sc = statusColor(p, task.status)

  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: alpha(p.outline, 0.2), backgroundColor: p.container }}>
      <Pressable onPress={() => onOpen(task)} accessibilityRole="button" accessibilityLabel={task.title} style={({ pressed }) => ({ borderRadius: 16, padding: 16, paddingRight: 56, backgroundColor: pressed ? p.high : 'transparent' })}>
        {showStatus && (
          <View style={{ alignSelf: 'flex-start', marginBottom: 8, borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: alpha(sc, 0.15), borderColor: alpha(sc, 0.3) }}>
            <Txt w="700" size={12} upper track={0.6} color={sc}>{STATUS_LABEL[task.status]}</Txt>
          </View>
        )}
        <Txt w="600" size={16} color={done ? alpha(p.onSurface, 0.7) : p.onSurface} style={{ lineHeight: 22, textDecorationLine: done ? 'line-through' : 'none' }}>{task.title}</Txt>
        {!!task.description && <Txt size={14} numberOfLines={2} color={alpha(p.onSurface, 0.8)} style={{ marginTop: 4, lineHeight: 21 }}>{task.description}</Txt>}

        {!!task.tags?.length && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>{task.tags.map((t) => <TagBadge key={t.id} tag={t} />)}</View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 }}>
          {due && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Calendar size={16} color={overdue ? p.error : alpha(p.onSurface, 0.8)} />
              <Txt w={overdue ? '600' : '400'} size={14} color={overdue ? p.error : alpha(p.onSurface, 0.8)}>{fmtShort(due)}</Txt>
            </View>
          )}
          {(task.comment_count ?? 0) > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><MessageSquare size={16} color={alpha(p.onSurface, 0.8)} /><Txt size={14} color={alpha(p.onSurface, 0.8)}>{task.comment_count}</Txt></View>
          )}
          {(task.attachment_count ?? 0) > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Paperclip size={16} color={alpha(p.onSurface, 0.8)} /><Txt size={14} color={alpha(p.onSurface, 0.8)}>{task.attachment_count}</Txt></View>
          )}
          {task.assigned_to && <View style={{ marginLeft: 'auto' }}><Avatar id={task.assigned_to} name={task.assignee?.full_name} uri={task.assignee?.avatar_url} size={24} /></View>}
        </View>
      </Pressable>
      <Pressable onPress={() => onMenu(task)} accessibilityRole="button" accessibilityLabel={`Acciones de la tarea ${task.title}`} style={({ pressed }) => ({ position: 'absolute', right: 4, top: 4, width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? p.high : 'transparent' })}>
        <MoreVertical size={20} color={alpha(p.onSurface, 0.8)} />
      </Pressable>
    </View>
  )
})

/** Menú de acciones de una tarea: es también la alternativa a arrastrar para mover tarjetas. */
export function TaskActionSheet({ task, onClose, userId, role, onOpen, onMove, onDelete }: {
  task: Task | null; onClose: () => void; userId: string; role: TeamRole; onOpen: (t: Task) => void; onMove: (t: Task, s: TaskStatus) => void; onDelete: (t: Task) => void
}) {
  const p = usePalette()
  const [confirming, setConfirming] = useState(false)
  const close = () => { setConfirming(false); onClose() }

  const res = task ? { ownerId: task.user_id, assignedTo: task.assigned_to } : {}
  const canMove = !!task && can(userId, role, 'task:move', res)
  const canDelete = !!task && can(userId, role, 'task:delete', res)
  const row = (onPress: () => void, children: React.ReactNode, key?: string) => (
    <Pressable key={key} onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, paddingHorizontal: 12, backgroundColor: pressed ? p.highest : 'transparent' })}>{children}</Pressable>
  )

  return (
    <BottomSheet open={!!task} onClose={close} title={task?.title ?? ''}>
      {task && (
        <View style={{ gap: 4 }}>
          {row(() => { close(); onOpen(task) }, <><ExternalLink size={20} color={p.onSurfaceVariant} /><Txt w="500" size={16}>Abrir tarea</Txt></>)}

          {canMove && (
            <>
              <Txt w="700" size={12} upper track={1} color={p.onSurfaceVariant} style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 }}>Mover a</Txt>
              {STATUSES.filter((s) => s !== task.status).map((s) =>
                row(() => { close(); onMove(task, s) }, (
                  <>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: statusColor(p, s) }} />
                    <Txt w="500" size={16} style={{ flex: 1 }}>{STATUS_LABEL[s]}</Txt>
                    <ArrowRight size={16} color={p.onSurfaceVariant} />
                  </>
                ), s),
              )}
            </>
          )}

          {canDelete && (
            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: alpha(p.outline, 0.15) }}>
              {confirming ? (
                <View accessibilityRole="alert" style={{ borderRadius: 12, borderWidth: 1, borderColor: alpha(p.error, 0.3), backgroundColor: alpha(p.error, 0.1), padding: 12, gap: 12 }}>
                  <Txt size={14}>¿Eliminar esta tarea? Se borrarán también sus comentarios y archivos.</Txt>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Btn label="Cancelar" variant="outline" onPress={() => setConfirming(false)} style={{ flex: 1 }} />
                    <Btn label="Sí, eliminar" variant="danger" onPress={() => { close(); onDelete(task) }} style={{ flex: 1 }} />
                  </View>
                </View>
              ) : (
                row(() => setConfirming(true), <><Trash2 size={20} color={p.error} /><Txt w="500" size={16} color={p.error}>Eliminar tarea</Txt></>)
              )}
            </View>
          )}

          {!canMove && !canDelete && <Txt size={14} color={p.onSurfaceVariant} style={{ paddingHorizontal: 12, paddingVertical: 8 }}>Solo puedes ver esta tarea. Pide a quien la creó o a un administrador que la modifique.</Txt>}
        </View>
      )}
    </BottomSheet>
  )
}

interface ListProps {
  tasks: Task[]
  userId: string
  role: TeamRole
  onOpen: (t: Task) => void
  onMove: (t: Task, s: TaskStatus) => void
  onDelete: (t: Task) => void
  /** Hueco inferior para la navegación y el botón flotante. */
  bottomInset: number
  refreshControl?: React.ReactElement
}

/** Vista de lista: tarjetas ordenadas por fecha límite (las que no tienen, al final). */
export function TaskList(props: ListProps) {
  const p = usePalette()
  const now = useNow()
  const [menuTask, setMenuTask] = useState<Task | null>(null)
  const sorted = useMemo(() => [...props.tasks].sort((a, b) => (toMs(a.due_date) || Infinity) - (toMs(b.due_date) || Infinity)), [props.tasks])

  return (
    <ScrollView refreshControl={props.refreshControl} contentContainerStyle={{ padding: 16, paddingBottom: props.bottomInset }} style={{ flex: 1 }}>
      <Txt size={14} color={alpha(p.onSurface, 0.8)} style={{ marginBottom: 12 }}>{sorted.length} {sorted.length === 1 ? 'tarea' : 'tareas'}, por fecha límite</Txt>
      {sorted.length === 0 ? <Empty>No hay tareas que coincidan con los filtros.</Empty> : (
        <View style={{ gap: 12 }}>{sorted.map((t) => <TaskCard key={t.id} task={t} now={now} showStatus onOpen={props.onOpen} onMenu={setMenuTask} />)}</View>
      )}
      <TaskActionSheet task={menuTask} onClose={() => setMenuTask(null)} userId={props.userId} role={props.role} onOpen={props.onOpen} onMove={props.onMove} onDelete={props.onDelete} />
    </ScrollView>
  )
}

/** Tablero móvil: pestañas por estado (con deslizamiento) o, agrupado, secciones por etiqueta. */
export function Board(props: ListProps & { groupBy: 'status' | 'tag'; allTags: Tag[]; activeStatus: TaskStatus; onActiveStatus: (s: TaskStatus) => void }) {
  const p = usePalette()
  const now = useNow()
  const { tasks, groupBy, allTags, activeStatus, onActiveStatus } = props
  const [menuTask, setMenuTask] = useState<Task | null>(null)
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)

  const counts = useMemo(() => {
    const c: Record<TaskStatus, number> = { pending: 0, in_progress: 0, completed: 0 }
    for (const t of tasks) c[t.status]++
    return c
  }, [tasks])

  // Solo un gesto claramente horizontal cambia de pestaña: no interfiere con el desplazamiento vertical.
  const onEnd = (x: number, y: number) => {
    if (!start) return
    const dx = x - start.x
    const dy = y - start.y
    setStart(null)
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return
    const i = STATUSES.indexOf(activeStatus) + (dx < 0 ? 1 : -1)
    if (i >= 0 && i < STATUSES.length) onActiveStatus(STATUSES[i])
  }

  let body: React.ReactNode
  if (groupBy === 'status') {
    const list = tasks.filter((t) => t.status === activeStatus)
    body = list.length === 0
      ? <Empty>No hay tareas en {STATUS_LABEL[activeStatus]}.</Empty>
      : <View style={{ gap: 12 }}>{list.map((t) => <TaskCard key={t.id} task={t} now={now} onOpen={props.onOpen} onMenu={setMenuTask} />)}</View>
  } else {
    const groups = [
      ...allTags.map((tag) => ({ key: tag.id, name: tag.name, color: tag.color, items: tasks.filter((t) => t.tags?.some((x) => x.id === tag.id)) })),
      { key: 'none', name: 'Sin etiqueta', color: '', items: tasks.filter((t) => !t.tags || t.tags.length === 0) },
    ].filter((g) => g.items.length > 0)
    body = groups.length === 0 ? <Empty>No hay tareas que coincidan con los filtros.</Empty> : (
      <View style={{ gap: 24 }}>
        {groups.map((g) => (
          <View key={g.key}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {!!g.color && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: g.color }} />}
              <Txt w="700" size={14}>{g.name}</Txt>
              <View style={{ borderRadius: 999, backgroundColor: p.high, paddingHorizontal: 8, paddingVertical: 2 }}><Txt w="600" size={12} color={alpha(p.onSurface, 0.8)}>{g.items.length}</Txt></View>
            </View>
            <View style={{ gap: 12 }}>{g.items.map((t) => <TaskCard key={`${g.key}-${t.id}`} task={t} now={now} showStatus onOpen={props.onOpen} onMenu={setMenuTask} />)}</View>
          </View>
        ))}
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      {groupBy === 'status' && (
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderColor: alpha(p.outline, 0.15), backgroundColor: p.surface }}>
          {STATUSES.map((s) => {
            const on = s === activeStatus
            return (
              <Pressable key={s} onPress={() => onActiveStatus(s)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, minHeight: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: on ? p.primary : 'transparent' }}>
                <Txt w="700" size={13} color={on ? '#000' : alpha(p.onSurface, 0.8)} numberOfLines={1}>{STATUS_LABEL[s]}</Txt>
                <View style={{ borderRadius: 999, paddingHorizontal: 6, backgroundColor: on ? 'rgba(0,0,0,0.15)' : p.high }}><Txt w="600" size={12} color={on ? '#000' : alpha(p.onSurface, 0.8)}>{counts[s]}</Txt></View>
              </Pressable>
            )
          })}
        </View>
      )}
      <ScrollView
        refreshControl={props.refreshControl}
        onTouchStart={(e) => setStart({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })}
        onTouchEnd={(e) => onEnd(e.nativeEvent.pageX, e.nativeEvent.pageY)}
        contentContainerStyle={{ padding: 16, paddingBottom: props.bottomInset }}
        style={{ flex: 1 }}
      >
        {body}
      </ScrollView>
      <TaskActionSheet task={menuTask} onClose={() => setMenuTask(null)} userId={props.userId} role={props.role} onOpen={props.onOpen} onMove={props.onMove} onDelete={props.onDelete} />
    </View>
  )
}
