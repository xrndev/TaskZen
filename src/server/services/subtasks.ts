import { asc, count, eq, max } from 'drizzle-orm'
import { subtasks, tasks } from '@/db/schema'
import type { Db } from '@/server/db'
import type { Subtask } from '@/types'
import { notifyTeam, requireRole, ServiceError } from './common'
import { loadEditable } from './tasks'

const STEP = 1000
/** Tope técnico por tarea: una lista de comprobación, no un gestor de proyectos dentro de otro. */
export const MAX_SUBTASKS = 50

export async function listSubtasks(db: Db, userId: string, taskId: string): Promise<Subtask[]> {
  const [task] = await db.select({ team_id: tasks.team_id }).from(tasks).where(eq(tasks.id, taskId)).limit(1)
  // Mismo error para «no existe» y «no eres miembro».
  if (!task) throw new ServiceError('NOT_FOUND', 'Tarea no encontrada.')
  await requireRole(db, userId, task.team_id).catch(() => {
    throw new ServiceError('NOT_FOUND', 'Tarea no encontrada.')
  })
  return db.select().from(subtasks).where(eq(subtasks.task_id, taskId)).orderBy(asc(subtasks.position), asc(subtasks.created_at))
}

export async function createSubtask(db: Db, userId: string, taskId: string, title: string): Promise<Subtask> {
  const task = await loadEditable(db, userId, taskId, 'task:edit')
  const clean = title.trim()
  if (!clean) throw new ServiceError('INVALID', 'El texto es obligatorio.')
  const [{ top, total }] = await db
    .select({ top: max(subtasks.position), total: count() })
    .from(subtasks)
    .where(eq(subtasks.task_id, taskId))
  if (total >= MAX_SUBTASKS) throw new ServiceError('INVALID', `Una tarea admite hasta ${MAX_SUBTASKS} subtareas.`)
  const [row] = await db.insert(subtasks).values({ task_id: taskId, title: clean, position: (top ?? 0) + STEP }).returning()
  await notifyTeam(db, task.team_id)
  return row
}

async function loadSubtask(db: Db, userId: string, subtaskId: string) {
  const [sub] = await db.select().from(subtasks).where(eq(subtasks.id, subtaskId)).limit(1)
  if (!sub) throw new ServiceError('NOT_FOUND', 'Subtarea no encontrada.')
  // Editar la lista exige poder editar la tarea.
  const task = await loadEditable(db, userId, sub.task_id, 'task:edit')
  return { sub, task }
}

export async function updateSubtask(db: Db, userId: string, subtaskId: string, patch: { title?: string; done?: boolean }) {
  const { sub, task } = await loadSubtask(db, userId, subtaskId)
  const set: Partial<typeof subtasks.$inferInsert> = {}
  if (patch.title !== undefined) {
    const clean = patch.title.trim()
    if (!clean) throw new ServiceError('INVALID', 'El texto es obligatorio.')
    set.title = clean
  }
  if (patch.done !== undefined) set.done = patch.done
  if (Object.keys(set).length) await db.update(subtasks).set(set).where(eq(subtasks.id, sub.id))
  await notifyTeam(db, task.team_id)
}

export async function deleteSubtask(db: Db, userId: string, subtaskId: string) {
  const { sub, task } = await loadSubtask(db, userId, subtaskId)
  await db.delete(subtasks).where(eq(subtasks.id, sub.id))
  await notifyTeam(db, task.team_id)
}
