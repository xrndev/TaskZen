import { eq, sql } from 'drizzle-orm'
import { tags, taskTags, tasks } from '@/db/schema'
import { can } from '@/lib/permissions'
import { templateById } from '@/lib/templates'
import type { Db } from '@/server/db'
import { notifyTeam, requireRole, ServiceError } from './common'

const STEP = 1000
const DAY = 24 * 60 * 60 * 1000

/**
 * Rellena un tablero vacío con las etiquetas y tareas de una plantilla. Solo se aplica si el equipo no tiene
 * tareas: así nunca mezcla ejemplos con trabajo real. Las etiquetas que ya existan con el mismo nombre se reutilizan.
 */
export async function applyTemplate(db: Db, userId: string, teamId: string, templateId: string, now = new Date()) {
  const role = await requireRole(db, userId, teamId)
  if (!can(userId, role, 'task:create') || !can(userId, role, 'tag:create')) {
    throw new ServiceError('FORBIDDEN', 'No puedes crear tareas ni etiquetas aquí.')
  }
  const template = templateById(templateId)
  if (!template) throw new ServiceError('NOT_FOUND', 'Plantilla no encontrada.')

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(tasks).where(eq(tasks.team_id, teamId))
  if (n > 0) throw new ServiceError('CONFLICT', 'Las plantillas solo se aplican a un tablero vacío.')

  const created = await db.transaction(async (tx) => {
    const existing = await tx.select().from(tags).where(eq(tags.team_id, teamId))
    const tagId = new Map(existing.map((t) => [t.name.toLowerCase(), t.id]))
    for (const t of template.tags) {
      if (tagId.has(t.name.toLowerCase())) continue
      const [row] = await tx.insert(tags).values({ team_id: teamId, user_id: userId, name: t.name, color: t.color }).returning()
      tagId.set(t.name.toLowerCase(), row.id)
    }

    const next = { pending: STEP, in_progress: STEP, completed: STEP }
    let count = 0
    for (const t of template.tasks) {
      const [task] = await tx
        .insert(tasks)
        .values({
          team_id: teamId,
          user_id: userId,
          title: t.title,
          description: 'description' in t ? t.description : null,
          status: t.status,
          position: next[t.status],
          due_date: 'dueInDays' in t && t.dueInDays !== undefined ? new Date(now.getTime() + t.dueInDays * DAY).toISOString() : null,
        })
        .returning({ id: tasks.id })
      next[t.status] += STEP
      const id = 'tag' in t && t.tag ? tagId.get(t.tag.toLowerCase()) : undefined
      if (id) await tx.insert(taskTags).values({ task_id: task.id, tag_id: id })
      count++
    }
    return count
  })

  await notifyTeam(db, teamId)
  return { tasks: created }
}
