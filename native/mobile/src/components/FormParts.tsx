import { Check, ChevronDown, Plus, Tag as TagIcon, X } from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import type { Tag, TeamMember } from '@domain/types'
import { apiClient } from '@/lib/client'
import { alpha, usePalette } from '@/lib/theme'
import { BottomSheet } from './BottomSheet'
import { TagBadge } from './TaskViews'
import { Avatar, Btn, Field, Label, Txt, useToast } from './ui'

/** Selector de responsable: campo con el avatar y una hoja con los miembros (en la web es un `<select>`). */
export function AssigneeField({ members, value, onChange, disabled }: { members: TeamMember[]; value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const p = usePalette()
  const [open, setOpen] = useState(false)
  const current = members.find((m) => m.user_id === value)
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Responsable"
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, borderColor: alpha(p.outline, 0.3), backgroundColor: p.container, paddingHorizontal: 12, opacity: disabled ? 0.5 : 1 }}
      >
        <Avatar id={value || 'none'} name={current?.profile?.full_name} uri={current?.profile?.avatar_url} size={24} />
        <Txt size={16} style={{ flex: 1 }} numberOfLines={1}>{current ? `${current.profile?.full_name || current.profile?.email} (${current.role})` : 'Sin asignar'}</Txt>
        <ChevronDown size={16} color={p.onSurfaceVariant} />
      </Pressable>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Responsable">
        <View style={{ gap: 4 }}>
          {[{ id: '', label: 'Sin asignar', member: undefined as TeamMember | undefined }, ...members.map((m) => ({ id: m.user_id, label: `${m.profile?.full_name || m.profile?.email} (${m.role})`, member: m }))].map((o) => {
            const on = o.id === value
            return (
              <Pressable key={o.id || 'none'} onPress={() => { onChange(o.id); setOpen(false) }} accessibilityRole="button" style={({ pressed }) => ({ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, paddingHorizontal: 12, backgroundColor: on ? alpha(p.primary, 0.2) : pressed ? p.high : 'transparent' })}>
                <Avatar id={o.id || 'none'} name={o.member?.profile?.full_name} uri={o.member?.profile?.avatar_url} size={32} />
                <Txt w={on ? '700' : '500'} size={16} color={on ? p.primary : p.onSurface} style={{ flex: 1 }} numberOfLines={1}>{o.label}</Txt>
                {on && <Check size={18} color={p.primary} />}
              </Pressable>
            )
          })}
        </View>
      </BottomSheet>
    </>
  )
}

const PRESET_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b', '#22c55e', '#a855f7']

/** Hoja para elegir etiquetas (con jerarquía y búsqueda) y crear otras nuevas. También sirve para gestionarlas. */
export function TagPicker({ open, onClose, tags, teamId, selected, onChange, onCreated, title = 'Etiquetas / Categorías' }: {
  open: boolean; onClose: () => void; tags: Tag[]; teamId: string | null; selected: string[]; onChange: (ids: string[]) => void; onCreated: (tag: Tag) => void; title?: string
}) {
  const p = usePalette()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [parent, setParent] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const roots = useMemo(() => tags.filter((t) => !t.parent_id), [tags])
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

  const create = async () => {
    if (!teamId || !name.trim() || busy) return
    setBusy(true)
    try {
      const tag = await apiClient.createTag(teamId, { name: name.trim(), color, parent_id: parent })
      onCreated(tag)
      onChange([...selected, tag.id])
      setName(''); setParent(null); setCreating(false)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const item = (tag: Tag, depth = 0): React.ReactNode => {
    const on = selected.includes(tag.id)
    const children = tags.filter((t) => t.parent_id === tag.id)
    return (
      <View key={tag.id}>
        <Pressable onPress={() => toggle(tag.id)} accessibilityRole="button" accessibilityState={{ selected: on }} style={({ pressed }) => ({ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 12 + depth * 16, paddingRight: 12, borderRadius: 12, backgroundColor: on ? alpha(p.primary, 0.08) : pressed ? p.high : 'transparent' })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tag.color }} />
            <Txt w={on ? '600' : '400'} size={16} color={on ? p.primary : p.onSurface}>{tag.name}</Txt>
          </View>
          {on && <Check size={18} color={p.primary} />}
        </Pressable>
        {children.map((c) => item(c, depth + 1))}
      </View>
    )
  }

  return (
    <BottomSheet open={open} onClose={() => { setCreating(false); onClose() }} title={creating ? 'Nueva etiqueta' : title}>
      {creating ? (
        <View style={{ gap: 16, paddingBottom: 8 }}>
          <Field label="Nombre" value={name} onChangeText={setName} placeholder="Nombre de la etiqueta…" autoFocus maxLength={50} />
          <View style={{ gap: 8 }}>
            <Label>Color</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {PRESET_COLORS.map((c) => (
                <Pressable key={c} onPress={() => setColor(c)} accessibilityRole="button" accessibilityLabel={`Color ${c}`} accessibilityState={{ selected: color === c }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c, borderWidth: 3, borderColor: color === c ? '#ffffff' : 'transparent' }} />
              ))}
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Label>Etiqueta padre (opcional)</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Pressable onPress={() => setParent(null)} accessibilityRole="button" style={{ minHeight: 40, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, justifyContent: 'center', borderColor: parent === null ? p.primary : alpha(p.outline, 0.3), backgroundColor: parent === null ? alpha(p.primary, 0.2) : 'transparent' }}><Txt w="600" size={13} color={parent === null ? p.primary : p.onSurface}>Ninguna</Txt></Pressable>
              {tags.map((t) => (
                <Pressable key={t.id} onPress={() => setParent(t.id)} accessibilityRole="button" style={{ minHeight: 40, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, justifyContent: 'center', borderColor: parent === t.id ? p.primary : alpha(p.outline, 0.3), backgroundColor: parent === t.id ? alpha(p.primary, 0.2) : 'transparent' }}><Txt w="600" size={13} color={parent === t.id ? p.primary : p.onSurface}>{t.name}</Txt></Pressable>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Btn label="Cancelar" variant="outline" onPress={() => setCreating(false)} style={{ flex: 1 }} />
            <Btn label="Crear etiqueta" onPress={create} loading={busy} disabled={!name.trim()} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <View style={{ gap: 8, paddingBottom: 8 }}>
          <Field value={search} onChangeText={setSearch} placeholder="Buscar etiquetas…" />
          {roots.length === 0 ? (
            <View style={{ alignItems: 'center', gap: 8, paddingVertical: 24 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(p.primary, 0.1), borderWidth: 1, borderColor: alpha(p.primary, 0.2) }}><TagIcon size={24} color={p.primary} /></View>
              <Txt w="700" size={14}>No hay categorías aún</Txt>
              <Txt size={12} color={p.onSurfaceVariant} style={{ textAlign: 'center' }}>Crea una categoría para organizar tus tareas por temas, prioridad o departamentos.</Txt>
            </View>
          ) : (
            <View>{roots.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())).map((t) => item(t))}</View>
          )}
          <Btn label="Crear etiqueta" variant="soft" icon={Plus} onPress={() => setCreating(true)} />
          <Btn label="Listo" onPress={onClose} />
        </View>
      )}
    </BottomSheet>
  )
}

/** Fila de etiquetas elegidas con botón para abrir el selector. */
export function TagField({ tags, teamId, selected, onChange, onCreated }: { tags: Tag[]; teamId: string | null; selected: string[]; onChange: (ids: string[]) => void; onCreated: (tag: Tag) => void }) {
  const p = usePalette()
  const [open, setOpen] = useState(false)
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      {tags.filter((t) => selected.includes(t.id)).map((t) => (
        <Pressable key={t.id} onPress={() => onChange(selected.filter((x) => x !== t.id))} accessibilityRole="button" accessibilityLabel={`Quitar ${t.name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TagBadge tag={t} /><X size={12} color={t.color} />
        </Pressable>
      ))}
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" style={{ minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: alpha(p.outline, 0.3), backgroundColor: p.container, paddingHorizontal: 12 }}>
        <Plus size={14} color={p.onSurfaceVariant} />
        <Txt w="700" size={11} upper track={0.8} color={p.onSurfaceVariant}>Añadir etiqueta</Txt>
      </Pressable>
      <TagPicker open={open} onClose={() => setOpen(false)} tags={tags} teamId={teamId} selected={selected} onChange={onChange} onCreated={onCreated} />
    </View>
  )
}
