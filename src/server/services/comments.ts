import { asc, eq, inArray } from 'drizzle-orm'
import { attachments, comments, tasks, user } from '@/db/schema'
import { can } from '@/lib/permissions'
import type { Db } from '@/server/db'
import type { Attachment, TaskComment } from '@/types'
import { notifyTeam, profileColumns, roleIn, ServiceError } from './common'

/** Rol del usuario en el equipo de la tarea; NOT_FOUND si no existe o no es miembro. */
export async function taskAccess(db: Db, userId: string, taskId: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1)
  const role = task ? await roleIn(db, userId, task.team_id) : null
  if (!task || !role) throw new ServiceError('NOT_FOUND', 'Tarea no encontrada.')
  return { task, role }
}

export async function listComments(db: Db, userId: string, taskId: string): Promise<TaskComment[]> {
  await taskAccess(db, userId, taskId)
  const rows = await db
    .select({ comment: comments, profile: profileColumns })
    .from(comments)
    .innerJoin(user, eq(user.id, comments.user_id))
    .where(eq(comments.task_id, taskId))
    .orderBy(asc(comments.created_at))
  if (rows.length === 0) return []

  const files = await db
    .select()
    .from(attachments)
    .where(inArray(attachments.comment_id, rows.map((r) => r.comment.id)))
  const filesByComment = new Map<string, Attachment[]>()
  for (const f of files) filesByComment.set(f.comment_id!, [...(filesByComment.get(f.comment_id!) ?? []), f])

  const byId = new Map<string, TaskComment>()
  for (const r of rows) {
    byId.set(r.comment.id, { ...r.comment, profile: r.profile, replies: [], attachments: filesByComment.get(r.comment.id) ?? [] })
  }
  const roots: TaskComment[] = []
  for (const c of byId.values()) {
    const parent = c.parent_id ? byId.get(c.parent_id) : undefined
    if (parent) parent.replies!.push(c)
    else roots.push(c)
  }
  return roots
}

export async function createComment(
  db: Db,
  userId: string,
  taskId: string,
  content: string,
  parentId: string | null = null,
): Promise<TaskComment> {
  const { task, role } = await taskAccess(db, userId, taskId)
  if (!can(userId, role, 'comment:create')) throw new ServiceError('FORBIDDEN', 'No puedes comentar aquí.')
  const text = content.trim()
  if (!text) throw new ServiceError('INVALID', 'El comentario no puede estar vacío.')
  if (text.length > 5000) throw new ServiceError('INVALID', 'El comentario es demasiado largo.')
  if (parentId) {
    const [parent] = await db.select({ task_id: comments.task_id }).from(comments).where(eq(comments.id, parentId))
    if (!parent || parent.task_id !== taskId) throw new ServiceError('INVALID', 'Comentario padre no válido.')
  }
  const [comment] = await db
    .insert(comments)
    .values({ task_id: taskId, user_id: userId, content: text, parent_id: parentId })
    .returning()
  const [profile] = await db.select(profileColumns).from(user).where(eq(user.id, userId))
  await notifyTeam(db, task.team_id)
  return { ...comment, profile, replies: [], attachments: [] }
}

/** Devuelve las claves de archivo de los adjuntos eliminados en cascada. */
export async function deleteComment(db: Db, userId: string, commentId: string): Promise<string[]> {
  const [comment] = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1)
  if (!comment) throw new ServiceError('NOT_FOUND', 'Comentario no encontrado.')
  const { task, role } = await taskAccess(db, userId, comment.task_id)
  if (!can(userId, role, 'comment:delete', { ownerId: comment.user_id })) {
    throw new ServiceError('FORBIDDEN', 'No puedes borrar este comentario.')
  }
  // Los adjuntos de las respuestas también caen en cascada: hay que recogerlos antes.
  const all = await db.select({ id: comments.id, parent_id: comments.parent_id }).from(comments).where(eq(comments.task_id, comment.task_id))
  const doomed = new Set([commentId])
  let grew = true
  while (grew) {
    grew = false
    for (const c of all) if (c.parent_id && doomed.has(c.parent_id) && !doomed.has(c.id)) { doomed.add(c.id); grew = true }
  }
  const files = await db.select({ path: attachments.file_path }).from(attachments).where(inArray(attachments.comment_id, [...doomed]))
  await db.delete(comments).where(eq(comments.id, commentId))
  await notifyTeam(db, task.team_id)
  return files.map((f) => f.path)
}
