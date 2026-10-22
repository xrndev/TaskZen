import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import type { Task } from '@domain/types'
import { dayKey, fmtDay, fmtMonth, fmtTime, parseDate } from '@/lib/dates'
import { alpha, usePalette } from '@/lib/theme'
import { useNow } from '@/lib/useNow'
import { statusColor, STATUS_LABEL } from './TaskViews'
import { Empty, Txt } from './ui'

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/** Calendario móvil: rejilla compacta con puntos por estado y, debajo, la agenda del día elegido. */
export function CalendarView({ tasks, onOpen, bottomInset, refreshControl }: { tasks: Task[]; onOpen: (t: Task) => void; bottomInset: number; refreshControl?: React.ReactElement }) {
  const p = usePalette()
  const now = useNow(3_600_000)
  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [selected, setSelected] = useState(() => dayKey(new Date()))

  const { byDay, undated } = useMemo(() => {
    const byDay = new Map<string, Task[]>()
    const undated: Task[] = []
    for (const t of tasks) {
      const d = parseDate(t.due_date)
      if (!d) { undated.push(t); continue }
      const k = dayKey(d)
      byDay.set(k, [...(byDay.get(k) ?? []), t])
    }
    return { byDay, undated }
  }, [tasks])

  // Semanas desde el lunes, rellenando con los días de los meses contiguos.
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const offset = (first.getDay() + 6) % 7
    const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
    const total = Math.ceil((offset + days) / 7) * 7
    return Array.from({ length: total }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i - offset + 1))
  }, [cursor])

  const today = dayKey(new Date(now))
  const move = (delta: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1))
  const goToday = () => { const n = new Date(); setCursor(new Date(n.getFullYear(), n.getMonth(), 1)); setSelected(dayKey(n)) }
  const selectedDate = cells.find((d) => dayKey(d) === selected)
  const dayTasks = byDay.get(selected) ?? []

  const navBtn = { height: 44, borderRadius: 12, borderWidth: 1, borderColor: alpha(p.outline, 0.2), backgroundColor: p.container, alignItems: 'center' as const, justifyContent: 'center' as const }

  const taskRow = (t: Task) => {
    const d = parseDate(t.due_date)
    return (
      <Pressable key={t.id} onPress={() => onOpen(t)} accessibilityRole="button" style={({ pressed }) => ({ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, borderColor: alpha(p.outline, 0.2), backgroundColor: pressed ? p.high : p.container, paddingHorizontal: 16, paddingVertical: 8 })}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: statusColor(p, t.status) }} />
        <View style={{ flex: 1 }}>
          <Txt w="500" size={16} numberOfLines={1} color={t.status === 'completed' ? alpha(p.onSurface, 0.7) : p.onSurface} style={{ textDecorationLine: t.status === 'completed' ? 'line-through' : 'none' }}>{t.title}</Txt>
          <Txt size={14} color={alpha(p.onSurface, 0.8)}>{STATUS_LABEL[t.status]}{d ? ` · ${fmtTime(d)}` : ''}</Txt>
        </View>
      </Pressable>
    )
  }

  return (
    <ScrollView refreshControl={refreshControl} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: bottomInset }} style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Txt w="700" size={18} style={{ paddingHorizontal: 4, textTransform: 'capitalize' }}>{fmtMonth(cursor)}</Txt>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Pressable onPress={() => move(-1)} accessibilityRole="button" accessibilityLabel="Mes anterior" style={[navBtn, { width: 44 }]}><ChevronLeft size={20} color={p.onSurface} /></Pressable>
          <Pressable onPress={goToday} accessibilityRole="button" style={[navBtn, { paddingHorizontal: 12 }]}><Txt w="700" size={12} upper track={0.8}>Hoy</Txt></Pressable>
          <Pressable onPress={() => move(1)} accessibilityRole="button" accessibilityLabel="Mes siguiente" style={[navBtn, { width: 44 }]}><ChevronRight size={20} color={p.onSurface} /></Pressable>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {WEEKDAYS.map((d) => <View key={d} style={{ width: '14.2857%', paddingVertical: 4, alignItems: 'center' }}><Txt w="700" size={12} upper color={alpha(p.onSurface, 0.8)}>{d}</Txt></View>)}
        {cells.map((date) => {
          const k = dayKey(date)
          const list = byDay.get(k) ?? []
          const inMonth = date.getMonth() === cursor.getMonth()
          const on = k === selected
          const isToday = k === today
          return (
            <View key={k} style={{ width: '14.2857%', paddingVertical: 2, alignItems: 'center' }}>
              <Pressable
                onPress={() => { setSelected(k); if (!inMonth) setCursor(new Date(date.getFullYear(), date.getMonth(), 1)) }}
                accessibilityRole="button"
                accessibilityLabel={`${fmtDay(date)}, ${list.length === 0 ? 'sin tareas' : `${list.length} ${list.length === 1 ? 'tarea' : 'tareas'}`}`}
                accessibilityState={{ selected: on }}
                style={{ width: 44, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: on ? p.primary : 'transparent', borderWidth: !on && isToday ? 1 : 0, borderColor: p.primary }}
              >
                <Txt w="600" size={14} color={on ? '#000' : isToday ? p.primary : inMonth ? p.onSurface : alpha(p.onSurface, 0.7)}>{date.getDate()}</Txt>
                <View style={{ flexDirection: 'row', height: 6, gap: 2 }}>
                  {list.slice(0, 3).map((t) => <View key={t.id} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: on ? 'rgba(0,0,0,0.7)' : statusColor(p, t.status) }} />)}
                </View>
              </Pressable>
            </View>
          )
        })}
      </View>

      <View style={{ marginTop: 20 }}>
        <Txt w="700" size={14} style={{ marginBottom: 8, textTransform: 'capitalize' }}>{selectedDate ? fmtDay(selectedDate) : 'Día seleccionado'}</Txt>
        {dayTasks.length === 0 ? <Empty>No hay tareas con fecha límite este día.</Empty> : <View style={{ gap: 8 }}>{dayTasks.map(taskRow)}</View>}
      </View>

      {undated.length > 0 && (
        <View style={{ marginTop: 24 }}>
          <Txt w="700" size={14} style={{ marginBottom: 8 }}>Sin fecha límite ({undated.length})</Txt>
          <View style={{ gap: 8 }}>{undated.map(taskRow)}</View>
        </View>
      )}
    </ScrollView>
  )
}
