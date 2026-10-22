import { Calendar, Check, Clock, Download, FileText, Loader, MessageSquare, Paperclip, Plus, Reply, Send, ShieldAlert, Trash2, X } from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Attachment, Tag, Task, TaskComment, TaskStatus, TeamMember, TeamRole } from '@domain/types'
import { fmtComment, fmtLong, parseDate } from '@/lib/dates'
import { imageSource } from '@/lib/api'
import { apiClient } from '@/lib/client'
import { downloadAttachment, pickDocument } from '@/lib/files'
import { alpha, usePalette } from '@/lib/theme'
import { AssigneeField, TagField } from './FormParts'
import { STATUS_LABEL, STATUSES, TagBadge } from './TaskViews'
import { Avatar, Field, IconBtn, Label, Txt, useToast } from './ui'

interface Props {
  task: Task | null
  teamId: string | null
  members: TeamMember[]
  tags: Tag[]
  role: TeamRole
  userId: string
  onClose: () => void
  onUpdate: (id: string, patch: { title?: string; description?: string | null; tag_ids?: string[]; assigned_to?: string | null }) => Promise<void>
  onMove: (task: Task, status: TaskStatus) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onRefresh: () => void
  onTagCreated: (tag: Tag) => void
}

const Section = ({ title, right }: { title: string; right?: React.ReactNode }) => {
  const p = usePalette()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: alpha(p.outline, 0.1), paddingBottom: 8 }}>
      <Label>{title}</Label>
      {right}
    </View>
  )
}

const Link = ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) => {
  const p = usePalette()
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4, opacity: disabled ? 0.5 : 1 }}>
      <Txt w="700" size={12} upper track={0.8} color={p.primary}>{label}</Txt>
    </Pressable>
  )
}

export function TaskDetail(props: Props) {
  const { task } = props
  return (
    <Modal visible={!!task} animationType="slide" onRequestClose={props.onClose} statusBarTranslucent navigationBarTranslucent>
      {task && <Body key={task.id} {...props} task={task} />}
    </Modal>
  )
}

function Body({ task, teamId, members, tags, role, userId, onClose, onUpdate, onMove, onDelete, onRefresh, onTagCreated }: Props & { task: Task }) {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [desc, setDesc] = useState(task.description ?? '')
  const [tagIds, setTagIds] = useState<string[]>(task.tags?.map((t) => t.id) ?? [])
  const [assignee, setAssignee] = useState(task.assigned_to ?? '')
  const [busy, setBusy] = useState(false)

  const [comments, setComments] = useState<TaskComment[]>([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<TaskComment | null>(null)
  const [commentFile, setCommentFile] = useState<{ uri: string; name: string; mimeType?: string | null } | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)

  // Roles superiores a "member" o quien creó la tarea pueden editarla y borrarla (como en la web).
  const canManage = role === 'admin' || role === 'product_owner' || task.user_id === userId

  const loadComments = useCallback(async () => {
    try { setComments(await apiClient.comments(task.id)) } catch { /* sin conexión: se mantiene lo que había */ } finally { setLoadingComments(false) }
  }, [task.id])
  const loadAttachments = useCallback(async () => {
    try { setAttachments(await apiClient.attachments(task.id)) } catch { /* idem */ }
  }, [task.id])

  useEffect(() => { void loadComments(); void loadAttachments() }, [loadComments, loadAttachments])

  const fail = (e: unknown) => toast(e instanceof Error ? e.message : 'Ha ocurrido un error', 'error')

  const save = async () => {
    setBusy(true)
    try {
      await onUpdate(task.id, { title: title.trim() || 'Sin Título', description: desc, tag_ids: tagIds, assigned_to: assignee || null })
      setEditing(false)
    } catch (e) { fail(e) } finally { setBusy(false) }
  }
  const cancelEdit = () => { setEditing(false); setTitle(task.title); setDesc(task.description ?? ''); setAssignee(task.assigned_to ?? ''); setTagIds(task.tags?.map((t) => t.id) ?? []) }

  const confirm = (message: string, action: () => void) =>
    Alert.alert('Confirmar', message, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: action }])

  const remove = () => confirm('¿Estás seguro de que quieres eliminar esta tarea permanentemente? (Esta acción no se puede deshacer)', async () => {
    setBusy(true)
    try { await onDelete(task.id) } catch (e) { fail(e); setBusy(false) }
  })

  const addFile = async () => {
    try {
      const file = await pickDocument()
      if (!file) return
      setUploading(true)
      await apiClient.uploadAttachment(file, { taskId: task.id })
      await loadAttachments()
      onRefresh()
    } catch (e) { fail(e) } finally { setUploading(false) }
  }
  const removeAttachment = (att: Attachment) => confirm('¿Eliminar este archivo permanentemente?', async () => {
    try { await apiClient.deleteAttachment(att.id); await Promise.all([loadAttachments(), loadComments()]); onRefresh() } catch (e) { fail(e) }
  })
  const download = async (att: Attachment) => { try { await downloadAttachment(att) } catch (e) { fail(e) } }

  const publish = async () => {
    if (!draft.trim() && !commentFile) return
    setBusy(true)
    try {
      const c = await apiClient.createComment(task.id, draft, replyTo?.id ?? null)
      if (commentFile) {
        try { await apiClient.uploadAttachment(commentFile, { commentId: c.id }) } catch (e) { fail(e) }
      }
      setDraft(''); setCommentFile(null); setReplyTo(null)
      await loadComments()
      onRefresh()
    } catch (e) { fail(e) } finally { setBusy(false) }
  }
  const removeComment = (id: string) => confirm('¿Eliminar comentario?', async () => {
    try { await apiClient.deleteComment(id); await loadComments(); onRefresh() } catch (e) { fail(e) }
  })
  const attachToComment = async () => {
    try { const f = await pickDocument(); if (f) setCommentFile(f) } catch (e) { fail(e) }
  }

  const due = parseDate(task.due_date)
  const me = members.find((m) => m.user_id === userId)
  const box = { borderRadius: 12, borderWidth: 1, borderColor: alpha(p.outline, 0.1) }

  const commentItem = (c: TaskComment, isReply = false) => {
    const mine = c.user_id === userId
    return (
      <View key={c.id} style={{ flexDirection: 'row', gap: 12 }}>
        <Avatar id={c.user_id} name={c.profile?.full_name} uri={c.profile?.avatar_url} size={isReply ? 28 : 32} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Txt w="700" size={12}>{c.profile?.full_name || c.profile?.email}</Txt>
            <Txt size={10} color={alpha(p.onSurfaceVariant, 0.8)}>{fmtComment(parseDate(c.created_at) ?? new Date())}</Txt>
          </View>
          <View style={{ backgroundColor: p.high, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, borderTopLeftRadius: 0, borderWidth: 1, borderColor: alpha(p.outline, 0.1) }}>
            <Txt size={14} color={alpha(p.onSurface, 0.9)} style={{ lineHeight: 21 }}>{c.content}</Txt>
            {!!c.attachments?.length && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {c.attachments.map((a) => (
                  <Pressable key={a.id} onPress={() => download(a)} accessibilityRole="button" accessibilityLabel={`Descargar ${a.file_name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, borderRadius: 12, borderWidth: 1, borderColor: alpha(p.outline, 0.2), backgroundColor: p.container, paddingHorizontal: 8 }}>
                    <FileText size={14} color={p.onSurfaceVariant} />
                    <Txt w="500" size={11} numberOfLines={1} style={{ maxWidth: 120 }}>{a.file_name}</Txt>
                    {(mine || canManage) && <Pressable onPress={() => removeAttachment(a)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Eliminar archivo"><Trash2 size={13} color={alpha(p.error, 0.7)} /></Pressable>}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginLeft: 4 }}>
            {!isReply && (
              <Pressable onPress={() => setReplyTo(c)} accessibilityRole="button" style={{ minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Reply size={13} color={p.primary} /><Txt w="900" size={10} upper track={0.5} color={p.primary}>Responder</Txt>
              </Pressable>
            )}
            {mine && (
              <Pressable onPress={() => removeComment(c.id)} accessibilityRole="button" style={{ minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Trash2 size={13} color={p.onSurfaceVariant} /><Txt w="900" size={10} upper track={0.5} color={p.onSurfaceVariant}>Eliminar</Txt>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: p.low }}>
      {/* Botonera superior flotante */}
      <View style={{ position: 'absolute', top: Math.max(16, insets.top), right: 16, zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {editing && (
          <Pressable onPress={save} disabled={busy} accessibilityRole="button" style={{ height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 22, paddingHorizontal: 16, backgroundColor: p.primary, opacity: busy ? 0.6 : 1 }}>
            {busy ? <Loader size={16} color="#000" /> : <Check size={16} color="#000" />}
            <Txt w="700" size={11} upper track={0.8} color="#000">Guardar</Txt>
          </Pressable>
        )}
        {canManage && <IconBtn icon={Trash2} label="Eliminar tarea" onPress={remove} color={p.error} dimension={44} style={{ borderRadius: 22, backgroundColor: alpha(p.error, 0.1) }} />}
        <IconBtn icon={X} label="Cerrar" onPress={onClose} color={p.onSurfaceVariant} dimension={44} style={{ borderRadius: 22, backgroundColor: alpha(p.background, 0.5), borderWidth: 1, borderColor: alpha(p.outline, 0.2) }} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
        {task.image_url ? (
          <View style={{ height: 192, backgroundColor: p.high, borderBottomWidth: 1, borderColor: p.highest }}>
            <Image source={imageSource(task.image_url)} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          </View>
        ) : (
          <View style={{ height: 96 + insets.top * 0, backgroundColor: p.container, borderBottomWidth: 1, borderColor: p.highest, justifyContent: 'flex-end', paddingHorizontal: 24, paddingBottom: 16 }}>
            <View style={{ alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, borderColor: alpha(p.outline, 0.2), backgroundColor: p.bright, paddingHorizontal: 12, paddingVertical: 4 }}>
              <Txt w="700" size={10} upper track={1.5} color={p.dark ? p.onSurface : '#0f172a'}>{task.status.replace('_', ' ')}</Txt>
            </View>
          </View>
        )}

        <View style={{ padding: 24, gap: 24 }}>
          {/* Mover de estado (sin arrastrar) */}
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: p.container, borderWidth: 1, borderColor: alpha(p.outline, 0.2), borderRadius: 12, padding: 4 }}>
            {STATUSES.map((s) => {
              const on = task.status === s
              return (
                <Pressable key={s} disabled={busy} onPress={() => onMove(task, s)} accessibilityRole="radio" accessibilityState={{ checked: on }} style={{ flex: 1, minHeight: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? p.primary : 'transparent' }}>
                  <Txt w="700" size={12} upper track={1} color={on ? '#000' : p.onSurfaceVariant}>{s.replace('_', ' ')}</Txt>
                </Pressable>
              )
            })}
          </View>

          {/* Responsable */}
          <View style={{ gap: 8 }}>
            <Section title="Responsable" right={editing && !canManage ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><ShieldAlert size={12} color={p.error} /><Txt w="700" size={9} upper color={p.error}>Solo Admin / Propietario</Txt></View> : undefined} />
            {editing ? (
              <AssigneeField members={members} value={assignee} onChange={setAssignee} disabled={!canManage} />
            ) : (
              <Pressable onPress={() => canManage && setEditing(true)} style={[box, { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: p.low }]}>
                <Avatar id={task.assigned_to} name={task.assignee?.full_name} uri={task.assignee?.avatar_url} size={32} />
                <View>
                  <Txt w="700" size={10} upper track={1.5} color={p.onSurfaceVariant}>Asignado a</Txt>
                  <Txt w="600" size={16}>{task.assignee?.full_name || 'Sin asignar'}</Txt>
                </View>
              </Pressable>
            )}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <View style={{ borderRadius: 999, borderWidth: 1, borderColor: alpha(p.primary, 0.2), backgroundColor: alpha(p.primary, 0.2), paddingHorizontal: 12, paddingVertical: 4 }}>
              <Txt w="700" size={10} upper track={1.5} color={p.primary}>{task.status.replace('_', ' ')}</Txt>
            </View>
            {task.tags?.map((t) => <TagBadge key={t.id} tag={t} />)}
          </View>

          {/* Título */}
          {editing ? (
            <Field value={title} onChangeText={setTitle} autoFocus maxLength={200} style={{ fontFamily: 'Geist_700Bold', fontSize: 22, borderColor: alpha(p.primary, 0.5), backgroundColor: 'transparent' }} />
          ) : (
            <Txt w="700" size={24} style={{ lineHeight: 30 }}>{task.title}</Txt>
          )}

          {due && (
            <View style={[box, { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: p.container }]}>
              <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(p.error, 0.1), borderWidth: 1, borderColor: alpha(p.error, 0.2) }}><Clock size={16} color={p.error} /></View>
              <View style={{ flex: 1 }}>
                <Txt w="700" size={12} upper track={1.5} color={p.error}>Plazo / Límite</Txt>
                <Txt w="600" size={14}>{fmtLong(due)}</Txt>
              </View>
            </View>
          )}

          {/* Etiquetas */}
          <View style={{ gap: 8 }}>
            <Section title="Etiquetas / Categorías" right={!editing && canManage ? <Link label="Gestionar" onPress={() => setEditing(true)} /> : undefined} />
            {editing ? (
              <TagField tags={tags} teamId={teamId} selected={tagIds} onChange={setTagIds} onCreated={onTagCreated} />
            ) : (
              <Pressable onPress={() => canManage && setEditing(true)} style={{ minHeight: 40, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: 8, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: alpha(p.outline, 0.3), backgroundColor: p.low }}>
                {task.tags?.length ? task.tags.map((t) => <TagBadge key={t.id} tag={t} />) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 }}>
                    {canManage && <Plus size={12} color={p.primary} />}
                    <Txt w="500" size={14} color={p.onSurfaceVariant}>{canManage ? 'Añadir etiquetas o categorías…' : 'Sin etiquetas'}</Txt>
                  </View>
                )}
              </Pressable>
            )}
          </View>

          {/* Descripción */}
          <View style={{ gap: 8 }}>
            <Section title="Descripción larga" right={!editing && canManage ? <Link label="Editar texto" onPress={() => setEditing(true)} /> : undefined} />
            {editing ? (
              <Field value={desc} onChangeText={setDesc} multiline placeholder="Escribe especificaciones, enlaces, notas…" style={{ minHeight: 160, borderColor: alpha(p.primary, 0.3), fontSize: 14, lineHeight: 22 }} maxLength={5000} />
            ) : (
              <Pressable onPress={() => canManage && setEditing(true)} style={{ minHeight: 120, borderRadius: 12, backgroundColor: p.lowest, padding: 12 }}>
                {task.description ? <Txt size={14} color={alpha(p.onSurface, 0.8)} style={{ lineHeight: 22 }}>{task.description}</Txt> : <Txt size={14} color={alpha(p.onSurfaceVariant, 0.5)} style={{ fontStyle: 'italic' }}>Sin descripción general.</Txt>}
              </Pressable>
            )}
          </View>

          {/* Adjuntos */}
          <View style={{ gap: 8 }}>
            <Section title="Archivos adjuntos" right={<Link label={uploading ? 'Subiendo…' : 'Añadir archivo'} onPress={addFile} disabled={uploading} />} />
            {attachments.length > 0 ? (
              <View style={{ gap: 8 }}>
                {attachments.map((a) => (
                  <View key={a.id} style={[box, { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, backgroundColor: p.container }]}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: p.high }}><FileText size={16} color={p.onSurfaceVariant} /></View>
                    <View style={{ flex: 1 }}>
                      <Txt w="700" size={12} numberOfLines={1}>{a.file_name}</Txt>
                      <Txt size={10} color={alpha(p.onSurfaceVariant, 0.8)}>{(a.size / 1024 / 1024).toFixed(2)} MB</Txt>
                    </View>
                    <IconBtn icon={Download} label={`Descargar ${a.file_name}`} onPress={() => download(a)} color={p.primary} size={18} />
                    {canManage && <IconBtn icon={Trash2} label="Eliminar archivo" onPress={() => removeAttachment(a)} color={alpha(p.error, 0.8)} size={18} />}
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 24, borderWidth: 2, borderStyle: 'dashed', borderColor: alpha(p.outline, 0.2), borderRadius: 16 }}>
                <Paperclip size={24} color={alpha(p.onSurfaceVariant, 0.3)} />
                <Txt w="500" size={11} color={alpha(p.onSurfaceVariant, 0.6)} style={{ marginTop: 8 }}>No hay archivos en esta tarea</Txt>
              </View>
            )}
          </View>

          {/* Comentarios */}
          <View style={{ gap: 16, marginTop: 8, paddingTop: 24, borderTopWidth: 1, borderColor: alpha(p.outline, 0.1) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={20} color={p.primary} />
              <Txt w="700" size={14} upper track={1}>Actividad y comentarios</Txt>
            </View>

            {loadingComments ? <ActivityIndicator color={p.primary} style={{ paddingVertical: 24 }} /> : comments.length > 0 ? (
              <View style={{ gap: 24 }}>
                {comments.map((c) => (
                  <View key={c.id} style={{ gap: 12 }}>
                    {commentItem(c)}
                    {!!c.replies?.length && <View style={{ marginLeft: 40, gap: 16, borderLeftWidth: 2, borderColor: alpha(p.outline, 0.1), paddingLeft: 16 }}>{c.replies.map((r) => commentItem(r, true))}</View>}
                  </View>
                ))}
              </View>
            ) : <Txt size={12} color={alpha(p.onSurfaceVariant, 0.6)} style={{ fontStyle: 'italic', paddingVertical: 16 }}>No hay comentarios aún. ¡Sé el primero en decir algo!</Txt>}

            <View style={{ gap: 12, backgroundColor: p.container, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: alpha(p.outline, 0.2) }}>
              {replyTo && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: alpha(p.primary, 0.1), paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: alpha(p.primary, 0.2) }}>
                  <Txt w="700" size={10} upper color={p.primary} style={{ flex: 1 }} numberOfLines={1}>Respondiendo a {replyTo.profile?.full_name || replyTo.profile?.email}</Txt>
                  <Pressable onPress={() => setReplyTo(null)} accessibilityRole="button" hitSlop={10}><Txt size={11} color={p.onSurfaceVariant}>✕ Cancelar</Txt></Pressable>
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Avatar id={userId} name={me?.profile?.full_name} uri={me?.profile?.avatar_url} size={32} />
                <Field value={draft} onChangeText={setDraft} multiline placeholder="Escribe un comentario…" maxLength={5000} style={{ borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0, minHeight: 56 }} />
              </View>
              {commentFile && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginLeft: 44, backgroundColor: alpha(p.highest, 0.5), padding: 8, borderRadius: 12, borderWidth: 1, borderColor: alpha(p.outline, 0.2) }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}><FileText size={16} color={p.primary} /><Txt w="700" size={11} numberOfLines={1}>{commentFile.name}</Txt></View>
                  <IconBtn icon={X} label="Quitar archivo" onPress={() => setCommentFile(null)} color={p.error} size={16} dimension={36} />
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderColor: alpha(p.outline, 0.1) }}>
                <IconBtn icon={Paperclip} label="Adjuntar archivo (máx 10 MB)" onPress={attachToComment} color={p.onSurfaceVariant} size={18} />
                <Pressable onPress={publish} disabled={busy || (!draft.trim() && !commentFile)} accessibilityRole="button" style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, paddingHorizontal: 16, backgroundColor: p.primary, opacity: busy || (!draft.trim() && !commentFile) ? 0.5 : 1 }}>
                  <Send size={13} color="#000" />
                  <Txt w="700" size={11} upper track={0.8} color="#000">{busy ? 'Enviando…' : 'Publicar'}</Txt>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {editing && (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, padding: 16, paddingBottom: 16 + insets.bottom, borderTopWidth: 1, borderColor: p.high, backgroundColor: p.low }}>
          <Pressable onPress={cancelEdit} accessibilityRole="button" style={{ minHeight: 48, paddingHorizontal: 20, justifyContent: 'center' }}><Txt w="700" size={12} upper track={0.8} color={p.onSurfaceVariant}>Cancelar</Txt></Pressable>
          <Pressable onPress={save} disabled={busy} accessibilityRole="button" style={{ minHeight: 48, paddingHorizontal: 24, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.primary, opacity: busy ? 0.5 : 1 }}>
            <Txt w="700" size={12} upper track={0.8} color="#000">{busy ? 'Guardando…' : '✓ Guardar cambios'}</Txt>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}
