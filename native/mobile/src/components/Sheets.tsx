import { Check, Download, LogOut, Palette, Plus, Settings, Tag as TagIcon, User, Users } from 'lucide-react-native'
import * as Linking from 'expo-linking'
import { Pressable, View } from 'react-native'
import type { Tag, TeamMember } from '@domain/types'
import { API_URL } from '@/lib/api'
import { alpha, THEME_IDS, THEMES, usePalette, useTheme } from '@/lib/theme'
import { BottomSheet } from './BottomSheet'
import { DateField, fromDateInput, toDateInput } from './DateField'
import { Avatar, Btn, Chip, Label, Txt } from './ui'

export interface Filters {
  assigneeId: string | null
  tagIds: string[]
  range: { start: string | null; end: string | null }
}

export const NO_FILTERS: Filters = { assigneeId: null, tagIds: [], range: { start: null, end: null } }
export const countFilters = (f: Filters) => f.tagIds.length + (f.assigneeId ? 1 : 0) + (f.range.start || f.range.end ? 1 : 0)

export function FiltersSheet(props: {
  open: boolean
  onClose: () => void
  groupBy: 'status' | 'tag'
  onGroupBy: (g: 'status' | 'tag') => void
  showGroupBy: boolean
  members: TeamMember[]
  tags: Tag[]
  filters: Filters
  onFilters: (f: Filters) => void
}) {
  const { filters, onFilters } = props
  const count = countFilters(filters)
  const p = usePalette()
  return (
    <BottomSheet open={props.open} onClose={props.onClose} title="Filtros">
      <View style={{ gap: 24, paddingBottom: 8 }}>
        {props.showGroupBy && (
          <View style={{ gap: 8 }}>
            <Label>Agrupar el tablero por</Label>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([['status', 'Estado'], ['tag', 'Etiqueta']] as const).map(([id, text]) => (
                <View key={id} style={{ flex: 1 }}><Chip label={text} on={props.groupBy === id} onPress={() => props.onGroupBy(id)} /></View>
              ))}
            </View>
          </View>
        )}

        <View style={{ gap: 8 }}>
          <Label>Responsable</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label="Todos" on={filters.assigneeId === null} onPress={() => onFilters({ ...filters, assigneeId: null })} left={<Users size={16} color={filters.assigneeId === null ? p.primary : p.onSurface} />} />
            {props.members.map((m) => (
              <Chip
                key={m.user_id}
                label={m.profile?.full_name || 'Sin nombre'}
                on={filters.assigneeId === m.user_id}
                onPress={() => onFilters({ ...filters, assigneeId: filters.assigneeId === m.user_id ? null : m.user_id })}
                left={<Avatar id={m.user_id} name={m.profile?.full_name} uri={m.profile?.avatar_url} size={24} />}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Label>Fecha límite</Label>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}><DateField label="Desde" value={filters.range.start ? fromDateInput(filters.range.start) : null} onChange={(d) => onFilters({ ...filters, range: { ...filters.range, start: d ? toDateInput(d) : null } })} /></View>
            <View style={{ flex: 1 }}><DateField label="Hasta" value={filters.range.end ? fromDateInput(filters.range.end) : null} onChange={(d) => onFilters({ ...filters, range: { ...filters.range, end: d ? toDateInput(d) : null } })} /></View>
          </View>
        </View>

        {props.tags.length > 0 && (
          <View style={{ gap: 8 }}>
            <Label>Etiquetas</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {props.tags.map((t) => {
                const on = filters.tagIds.includes(t.id)
                return <Chip key={t.id} label={t.name} on={on} onPress={() => onFilters({ ...filters, tagIds: on ? filters.tagIds.filter((x) => x !== t.id) : [...filters.tagIds, t.id] })} left={<View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: t.color }} />} />
              })}
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 12, paddingTop: 12, borderTopWidth: 1, borderColor: alpha(p.outline, 0.15) }}>
          <Btn label={`Limpiar${count ? ` (${count})` : ''}`} variant="outline" disabled={count === 0} onPress={() => onFilters(NO_FILTERS)} style={{ flex: 1 }} />
          <Btn label="Ver resultados" onPress={props.onClose} style={{ flex: 1 }} />
        </View>
      </View>
    </BottomSheet>
  )
}

export function MoreSheet(props: {
  open: boolean
  onClose: () => void
  isAdmin: boolean
  teamName: string | null
  onTeamSettings: () => void
  onNewTeam: () => void
  onTags: () => void
  onProfile: () => void
  onLogout: () => void
}) {
  const p = usePalette()
  const { themeId, setTheme } = useTheme()
  const go = (fn: () => void) => () => { props.onClose(); fn() }
  const row = (key: string, onPress: () => void, icon: React.ReactNode, label: string, color?: string) => (
    <Pressable key={key} onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, paddingHorizontal: 12, backgroundColor: pressed ? p.highest : 'transparent' })}>
      {icon}
      <Txt w="500" size={16} color={color}>{label}</Txt>
    </Pressable>
  )
  const ic = { size: 20, color: p.onSurfaceVariant }

  return (
    <BottomSheet open={props.open} onClose={props.onClose} title="Más opciones">
      <View style={{ gap: 4, paddingBottom: 8 }}>
        {props.isAdmin && row('team', go(props.onTeamSettings), <Settings {...ic} />, `Gestionar equipo${props.teamName ? ` · ${props.teamName}` : ''}`)}
        {row('new', go(props.onNewTeam), <Plus {...ic} />, 'Crear un equipo')}
        {row('tags', go(props.onTags), <TagIcon {...ic} />, 'Gestionar etiquetas')}

        <View style={{ paddingHorizontal: 12, paddingVertical: 8, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Palette {...ic} /><Txt w="500" size={16}>Apariencia</Txt></View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {THEME_IDS.map((id) => {
              const on = id === themeId
              return (
                <Pressable key={id} onPress={() => setTheme(id)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, borderColor: on ? p.primary : alpha(p.outline, 0.3), backgroundColor: on ? alpha(p.primary, 0.2) : 'transparent' }}>
                  <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: on ? p.primary : alpha(p.outline, 0.5), backgroundColor: THEMES[id].swatch }} />
                  <Txt w="700" size={11} upper track={0.8} color={on ? p.primary : p.onSurface}>{THEMES[id].name}</Txt>
                  {on && <Check size={14} color={p.primary} />}
                </Pressable>
              )
            })}
          </View>
        </View>

        {row('profile', go(props.onProfile), <User {...ic} />, 'Mi perfil y seguridad')}
        {row('install', () => { props.onClose(); void Linking.openURL(`${API_URL}/instalar`) }, <Download {...ic} />, 'Instalar la app o compartirla')}
        <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: alpha(p.outline, 0.15) }}>
          {row('logout', go(props.onLogout), <LogOut size={20} color={p.error} />, 'Cerrar sesión', p.error)}
        </View>
      </View>
    </BottomSheet>
  )
}
