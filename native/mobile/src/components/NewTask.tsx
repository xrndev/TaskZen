import { useState } from 'react'
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Tag, TeamMember } from '@domain/types'
import { imageSource } from '@/lib/api'
import { apiClient } from '@/lib/client'
import { pickImage } from '@/lib/files'
import { alpha, usePalette } from '@/lib/theme'
import { DateField } from './DateField'
import { AssigneeField, TagField } from './FormParts'
import { Btn, Field, Label, Txt, useToast } from './ui'

export interface NewTaskData {
  title: string
  description: string | null
  due_date: string | null
  image_url: string | null
  assigned_to: string | null
  tag_ids: string[]
}

/** "Crear nueva tarea": los mismos campos que el modal de la web, a pantalla completa. */
export function NewTask({ open, onClose, onSubmit, members, tags, teamId, onTagCreated }: {
  open: boolean; onClose: () => void; onSubmit: (data: NewTaskData) => Promise<void>; members: TeamMember[]; tags: Tag[]; teamId: string | null; onTagCreated: (tag: Tag) => void
}) {
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      {open && <Form onClose={onClose} onSubmit={onSubmit} members={members} tags={tags} teamId={teamId} onTagCreated={onTagCreated} />}
    </Modal>
  )
}

function Form({ onClose, onSubmit, members, tags, teamId, onTagCreated }: Omit<Parameters<typeof NewTask>[0], 'open'>) {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [due, setDue] = useState<Date | null>(null)
  const [assignee, setAssignee] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [imageMode, setImageMode] = useState<'url' | 'upload'>('url')
  const [imageUrl, setImageUrl] = useState('')
  const [imageFile, setImageFile] = useState<{ uri: string; name: string; mimeType?: string | null } | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!title.trim() || busy) return
    setBusy(true)
    try {
      let image: string | null = imageMode === 'url' ? imageUrl.trim() || null : null
      if (imageMode === 'upload' && imageFile) image = await apiClient.uploadCover(imageFile)
      await onSubmit({ title: title.trim(), description: description.trim() || null, due_date: due ? due.toISOString() : null, image_url: image, assigned_to: assignee || null, tag_ids: tagIds })
      onClose()
    } catch (e) {
      toast((e as Error).message, 'error')
      setBusy(false)
    }
  }

  const choose = async () => {
    try { const f = await pickImage(); if (f) setImageFile(f) } catch (e) { toast((e as Error).message, 'error') }
  }

  const tab = (mode: 'url' | 'upload', label: string) => (
    <Pressable onPress={() => setImageMode(mode)} accessibilityRole="button" style={{ minHeight: 40, justifyContent: 'center' }}>
      <Txt w="700" size={11} upper track={1} color={imageMode === mode ? p.primary : p.onSurfaceVariant}>{label}</Txt>
    </Pressable>
  )

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: p.low }}>
      <View style={{ paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 24, backgroundColor: p.container, borderBottomWidth: 1, borderColor: p.high, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt w="700" size={18}>Crear nueva tarea</Txt>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Txt size={18} color={p.onSurfaceVariant}>✕</Txt></Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 18 }}>
        <Field label="Título" value={title} onChangeText={setTitle} placeholder="Ej: Rediseñar la landing page…" autoFocus maxLength={200} />
        <Field label="Descripción corta" value={description} onChangeText={setDescription} placeholder="Agrega contexto a esta tarea…" multiline maxLength={5000} style={{ minHeight: 96 }} />
        <DateField label="Límite / fecha (opcional)" value={due} onChange={setDue} withTime />

        <View style={{ gap: 8 }}>
          <Label>Responsable (asignar a)</Label>
          <AssigneeField members={members} value={assignee} onChange={setAssignee} />
        </View>

        <View style={{ gap: 8 }}>
          <Label>Etiquetas / categorías</Label>
          <TagField tags={tags} teamId={teamId} selected={tagIds} onChange={setTagIds} onCreated={onTagCreated} />
        </View>

        <View style={{ borderWidth: 1, borderColor: alpha(p.outline, 0.2), borderRadius: 12, padding: 16, backgroundColor: p.container, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 20, borderBottomWidth: 1, borderColor: alpha(p.outline, 0.1) }}>
            {tab('url', 'Link ext.')}
            {tab('upload', 'Subir archivo')}
          </View>
          {imageMode === 'url' ? (
            <Field value={imageUrl} onChangeText={setImageUrl} placeholder="https://unsplash.com/foto.jpg" keyboardType="url" autoCapitalize="none" autoCorrect={false} style={{ fontSize: 14 }} />
          ) : (
            <View style={{ gap: 12 }}>
              {imageFile && <Image source={imageSource(imageFile.uri)} style={{ width: '100%', height: 140, borderRadius: 12 }} resizeMode="cover" />}
              <Btn label={imageFile ? 'Cambiar imagen' : 'Elegir imagen'} variant="soft" onPress={choose} />
            </View>
          )}
        </View>
      </ScrollView>

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, padding: 16, paddingBottom: 16 + insets.bottom, borderTopWidth: 1, borderColor: p.high }}>
        <Btn label="Cancelar" variant="ghost" onPress={onClose} disabled={busy} />
        <Btn label="Añadir al tablero" onPress={submit} loading={busy} disabled={!title.trim()} />
      </View>
    </KeyboardAvoidingView>
  )
}
