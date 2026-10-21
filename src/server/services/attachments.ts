import { desc, eq } from 'drizzle-orm'
import { attachments, comments } from '@/db/schema'
import { can } from '@/lib/permissions'
import type { Db } from '@/server/db'
import type { Attachment } from '@/types'
import { notifyTeam, ServiceError } from './common'
import { taskAccess } from './comments'

export const MAX_FILE_SIZE = 10 * 1024 * 1024

/** Tipos permitidos. Se valida el MIME declarado y, en la capa de almacenamiento, la firma del archivo. */
export const ALLOWED_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/zip': '.zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
}

/** Resuelve la tarea y el equipo a los que pertenece un adjunto (directo o vía comentario). */
async function resolveTaskId(db: Db, a: { task_id: string | null; comment_id: string | null }) {
  if (a.task_id) return a.task_id
  if (!a.comment_id) throw new ServiceError('INVALID', 'Adjunto huérfano.')
  const [c] = await db.select({ task_id: comments.task_id }).from(comments).where(eq(comments.id, a.comment_id))
  if (!c) throw new ServiceError('NOT_FOUND', 'Comentario no encontrado.')
  return c.task_id
}

export interface NewAttachment {
  task_id?: string | null
  comment_id?: string | null
  file_name: string
  file_path: string
  file_type: string
  size: number
}

/** Registra un archivo ya guardado en disco. Quien llama debe haber comprobado permisos con `authorizeUpload`. */
export async function authorizeUpload(db: Db, userId: string, target: { taskId?: string | null; commentId?: string | null }) {
  if (!!target.taskId === !!target.commentId) {
    throw new ServiceError('INVALID', 'Indica la tarea o el comentario de destino (solo uno).')
  }
  const taskId = await resolveTaskId(db, { task_id: target.taskId ?? null, comment_id: target.commentId ?? null })
  const { task, role } = await taskAccess(db, userId, taskId)
  if (!can(userId, role, 'attachment:upload')) throw new ServiceError('FORBIDDEN', 'No puedes adjuntar archivos aquí.')
  return task
}

export async function recordAttachment(db: Db, userId: string, input: NewAttachment): Promise<Attachment> {
  const task = await authorizeUpload(db, userId, { taskId: input.task_id, commentId: input.comment_id })
  const [row] = await db
    .insert(attachments)
    .values({
      task_id: input.task_id ?? null,
      comment_id: input.comment_id ?? null,
      user_id: userId,
      file_name: input.file_name.slice(0, 255),
      file_path: input.file_path,
      file_type: input.file_type,
      size: input.size,
    })
    .returning()
  await notifyTeam(db, task.team_id)
  return row
}

export async function listTaskAttachments(db: Db, userId: string, taskId: string): Promise<Attachment[]> {
  await taskAccess(db, userId, taskId)
  return db.select().from(attachments).where(eq(attachments.task_id, taskId)).orderBy(desc(attachments.created_at))
}

/** Adjunto + comprobación de que el usuario puede verlo. */
export async function getAccessibleAttachment(db: Db, userId: string, id: string) {
  const [att] = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1)
  if (!att) throw new ServiceError('NOT_FOUND', 'Archivo no encontrado.')
  const { task, role } = await taskAccess(db, userId, await resolveTaskId(db, att))
  return { att, task, role }
}

/** Devuelve la clave de archivo a borrar del disco. */
export async function deleteAttachment(db: Db, userId: string, id: string): Promise<string> {
  const { att, task, role } = await getAccessibleAttachment(db, userId, id)
  if (!can(userId, role, 'attachment:delete', { ownerId: att.user_id })) {
    throw new ServiceError('FORBIDDEN', 'No puedes borrar este archivo.')
  }
  await db.delete(attachments).where(eq(attachments.id, id))
  await notifyTeam(db, task.team_id)
  return att.file_path
}
