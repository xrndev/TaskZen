import { and, asc, count, eq, inArray, max } from 'drizzle-orm'
import { attachments, comments, tags, taskTags, tasks, user } from '@/db/schema'
import { can } from '@/lib/permissions'
import type { Db } from '@/server/db'
import type { Tag, Task, TaskStatus } from '@/types'
import { notifyTeam, profileColumns, requireRole, roleIn, ServiceError } from './common'

const STEP = 1000

export interface TaskInput {
  title: string
  description?: string | null
  due_date?: string | null
  image_url?: string | null
  assigned_to?: string | null
  tag_ids?: string[]
}

/** Carga el tablero de un equipo con etiquetas, responsable y contadores en pocas consultas. */
export async function listTasks(db: Db, userId: string, teamId: string): Promise<Task[]> {
  await requireRole(db, userId, teamId)

  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.team_id, teamId))
    .orderBy(asc(tasks.position), asc(tasks.created_at))
  if (rows.length === 0) return []
  const ids = rows.map((t) => t.id)

  const [tagRows, assignees, commentCounts, attachmentCounts] = await Promise.all([
    db
      .select({ task_id: taskTags.task_id, tag: tags })
      .from(taskTags)
      .innerJoin(tags, eq(tags.id, taskTags.tag_id))
      .where(inArray(taskTags.task_id, ids)),
    db
      .select(profileColumns)
      .from(user)
      .where(inArray(user.id, [...new Set(rows.map((t) => t.assigned_to).filter((v): v is string => !!v))])),
    db
      .select({ task_id: comments.task_id, n: count() })
      .from(comments)
      .where(inArray(comments.task_id, ids))
      .groupBy(comments.task_id),
    db
      .select({ task_id: attachments.task_id, n: count() })
      .from(attachments)
      .where(inArray(attachments.task_id, ids))
      .groupBy(attachments.task_id),
  ])

  const tagsByTask = new Map<string, Tag[]>()
  for (const r of tagRows) tagsByTask.set(r.task_id, [...(tagsByTask.get(r.task_id) ?? []), r.tag])
  const assigneeById = new Map(assignees.map((a) => [a.id, a]))
  const commentsByTask = new Map(commentCounts.map((c) => [c.task_id, c.n]))
  const attachmentsByTask = new Map(attachmentCounts.map((c) => [c.task_id, c.n]))

  return rows.map((t) => ({
    ...t,
    tags: tagsByTask.get(t.id) ?? [],
    assignee: t.assigned_to ? (assigneeById.get(t.assigned_to) ?? null) : null,
    comment_count: commentsByTask.get(t.id) ?? 0,
    attachment_count: attachmentsByTask.get(t.id) ?? 0,
  }))
}

async function assertAssignable(db: Db, teamId: string, assigneeId: string | null | undefined) {
  if (!assigneeId) return
  if (!(await roleIn(db, assigneeId, teamId))) {
    throw new ServiceError('INVALID', 'La persona asignada no pertenece al equipo.')
  }
}

async function assertTagsInTeam(db: Db, teamId: string, tagIds: string[]) {
  if (tagIds.length === 0) return
  const found = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.team_id, teamId), inArray(tags.id, tagIds)))
  if (found.length !== new Set(tagIds).size) throw new ServiceError('INVALID', 'Alguna etiqueta no pertenece al equipo.')
}

async function replaceTags(db: Db, taskId: string, tagIds: string[]) {
  await db.delete(taskTags).where(eq(taskTags.task_id, taskId))
  if (tagIds.length) {
    await db.insert(taskTags).values([...new Set(tagIds)].map((tag_id) => ({ task_id: taskId, tag_id })))
  }
}

export async function createTask(db: Db, userId: string, teamId: string, input: TaskInput) {
  const role = await requireRole(db, userId, teamId)
  if (!can(userId, role, 'task:create')) throw new ServiceError('FORBIDDEN', 'No puedes crear tareas aquí.')
  const title = input.title.trim()
  if (!title) throw new ServiceError('INVALID', 'El título es obligatorio.')
  await assertAssignable(db, teamId, input.assigned_to)
  await assertTagsInTeam(db, teamId, input.tag_ids ?? [])

  const [{ top }] = await db
    .select({ top: max(tasks.position) })
    .from(tasks)
    .where(and(eq(tasks.team_id, teamId), eq(tasks.status, 'pending')))

  const [task] = await db
    .insert(tasks)
    .values({
      team_id: teamId,
      user_id: userId,
      title,
      description: input.description?.trim() || null,
      due_date: input.due_date || null,
      image_url: input.image_url || null,
      assigned_to: input.assigned_to || null,
      status: 'pending',
      position: (top ?? 0) + STEP,
    })
    .returning()
  await replaceTags(db, task.id, input.tag_ids ?? [])
  await notifyTeam(db, teamId)
  return task
}

async function loadEditable(db: Db, userId: string, taskId: string, action: 'task:edit' | 'task:move' | 'task:delete') {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1)
  // Mismo error para "no existe" y "no eres miembro": no revela qué IDs existen.
  if (!task) throw new ServiceError('NOT_FOUND', 'Tarea no encontrada.')
  const role = await roleIn(db, userId, task.team_id)
  if (!role) throw new ServiceError('NOT_FOUND', 'Tarea no encontrada.')
  if (!can(userId, role, action, { ownerId: task.user_id, assignedTo: task.assigned_to })) {
    throw new ServiceError('FORBIDDEN', 'No tienes permiso para esta acción.')
  }
  return task
}

export async function updateTask(db: Db, userId: string, taskId: string, patch: Partial<TaskInput>) {
  const task = await loadEditable(db, userId, taskId, 'task:edit')
  if (patch.title !== undefined && !patch.title.trim()) throw new ServiceError('INVALID', 'El título es obligatorio.')
  if (patch.assigned_to !== undefined) await assertAssignable(db, task.team_id, patch.assigned_to)
  if (patch.tag_ids) await assertTagsInTeam(db, task.team_id, patch.tag_ids)

  const set: Partial<typeof tasks.$inferInsert> = {}
  if (patch.title !== undefined) set.title = patch.title.trim()
  if (patch.description !== undefined) set.description = patch.description?.trim() || null
  if (patch.due_date !== undefined) set.due_date = patch.due_date || null
  if (patch.image_url !== undefined) set.image_url = patch.image_url || null
  if (patch.assigned_to !== undefined) set.assigned_to = patch.assigned_to || null

  if (Object.keys(set).length) await db.update(tasks).set({ ...set, updated_at: new Date().toISOString() }).where(eq(tasks.id, taskId))
  if (patch.tag_ids) await replaceTags(db, taskId, patch.tag_ids)
  await notifyTeam(db, task.team_id)
}

/**
 * Mueve una tarea a una columna entre dos vecinas (por id). Solo se reescribe la tarea movida:
 * la posición es el punto medio entre las vecinas.
 */
export async function moveTask(
  db: Db,
  userId: string,
  taskId: string,
  target: { status: TaskStatus; prevId?: string | null; nextId?: string | null },
) {
  const task = await loadEditable(db, userId, taskId, 'task:move')

  const neighbourPos = async (id?: string | null) => {
    if (!id) return null
    const [n] = await db
      .select({ position: tasks.position })
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.team_id, task.team_id), eq(tasks.status, target.status)))
    if (!n) throw new ServiceError('INVALID', 'Posición de destino no válida.')
    return n.position
  }
  const prev = await neighbourPos(target.prevId)
  const next = await neighbourPos(target.nextId)

  let position: number
  if (prev !== null && next !== null) position = (prev + next) / 2
  else if (prev !== null) position = prev + STEP
  else if (next !== null) position = next - STEP
  else position = 0

  await db
    .update(tasks)
    .set({ status: target.status, position, updated_at: new Date().toISOString() })
    .where(eq(tasks.id, taskId))
  await notifyTeam(db, task.team_id)
}

/** Borra la tarea y devuelve las claves de los archivos que hay que retirar del disco. */
export async function deleteTask(db: Db, userId: string, taskId: string): Promise<string[]> {
  const task = await loadEditable(db, userId, taskId, 'task:delete')
  const commentIds = (await db.select({ id: comments.id }).from(comments).where(eq(comments.task_id, taskId))).map((c) => c.id)
  const files = await db
    .select({ id: attachments.id, path: attachments.file_path, task_id: attachments.task_id, comment_id: attachments.comment_id })
    .from(attachments)
    .where(eq(attachments.task_id, taskId))
  const commentFiles = commentIds.length
    ? await db.select({ path: attachments.file_path }).from(attachments).where(inArray(attachments.comment_id, commentIds))
    : []
  await db.delete(tasks).where(eq(tasks.id, taskId))
  await notifyTeam(db, task.team_id)
  return [...files.map((f) => f.path), ...commentFiles.map((f) => f.path)]
}
