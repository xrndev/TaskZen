import { and, asc, eq, inArray, or, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { attachments, comments, tags, taskTags, tasks, teamMembers, teams, user } from '@/db/schema'
import { can } from '@/lib/permissions'
import type { Db } from '@/server/db'
import { assertCanExport, teamLimits, userLimits } from './billing'
import { requireRole, ServiceError } from './common'

export type ExportFormat = 'csv' | 'json'
export interface ExportFile { filename: string; mime: string; content: string }

const STATUS_ES = { pending: 'Pendiente', in_progress: 'En curso', completed: 'Hecha' } as const

interface ExportTask {
  id: string
  team: string
  title: string
  description: string | null
  status: keyof typeof STATUS_ES
  due_date: string | null
  assignee: { name: string; email: string } | null
  tags: string[]
  comment_count: number
  attachment_count: number
  created_at: string
  updated_at: string
}

/** Tareas que cumplen `where`, con etiquetas y recuentos. Una consulta por tabla, no una por tarea. */
async function loadTasks(db: Db, where: SQL | undefined): Promise<ExportTask[]> {
  const assignee = alias(user, 'assignee')
  const rows = await db
    .select({
      id: tasks.id, team: teams.name, title: tasks.title, description: tasks.description, status: tasks.status, due_date: tasks.due_date,
      created_at: tasks.created_at, updated_at: tasks.updated_at, assignee_name: assignee.name, assignee_email: assignee.email,
    })
    .from(tasks)
    .innerJoin(teams, eq(teams.id, tasks.team_id))
    .leftJoin(assignee, eq(assignee.id, tasks.assigned_to))
    .where(where)
    .orderBy(asc(teams.name), asc(tasks.status), asc(tasks.position))
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)
  const tagRows = await db
    .select({ task_id: taskTags.task_id, name: tags.name })
    .from(taskTags)
    .innerJoin(tags, eq(tags.id, taskTags.tag_id))
    .where(inArray(taskTags.task_id, ids))
  const commentRows = await db.select({ task_id: comments.task_id }).from(comments).where(inArray(comments.task_id, ids))
  const attachmentRows = await db.select({ task_id: attachments.task_id }).from(attachments).where(inArray(attachments.task_id, ids))

  const group = <T extends { task_id: string | null }>(list: T[]) => {
    const m = new Map<string, T[]>()
    for (const r of list) if (r.task_id) m.set(r.task_id, [...(m.get(r.task_id) ?? []), r])
    return m
  }
  const tagsBy = group(tagRows)
  const commentsBy = group(commentRows)
  const attachmentsBy = group(attachmentRows)

  return rows.map((r) => ({
    id: r.id, team: r.team, title: r.title, description: r.description, status: r.status, due_date: r.due_date,
    assignee: r.assignee_name ? { name: r.assignee_name, email: r.assignee_email ?? '' } : null,
    tags: (tagsBy.get(r.id) ?? []).map((t) => t.name),
    comment_count: commentsBy.get(r.id)?.length ?? 0,
    attachment_count: attachmentsBy.get(r.id)?.length ?? 0,
    created_at: r.created_at, updated_at: r.updated_at,
  }))
}

/** Celda CSV. Un valor que empieza por `= + - @` lo interpretaría Excel como fórmula: se neutraliza con una comilla. */
function cell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(rows: ExportTask[], withTeam: boolean): string {
  const head = [...(withTeam ? ['Equipo'] : []), 'Título', 'Descripción', 'Estado', 'Fecha límite', 'Asignada a', 'Etiquetas', 'Comentarios', 'Adjuntos', 'Creada', 'Modificada']
  const lines = rows.map((t) => [
    ...(withTeam ? [t.team] : []), t.title, t.description, STATUS_ES[t.status], t.due_date, t.assignee ? `${t.assignee.name} <${t.assignee.email}>` : '',
    t.tags.join(', '), t.comment_count, t.attachment_count, t.created_at, t.updated_at,
  ])
  // BOM para que Excel abra bien las tildes; CRLF como pide el estándar.
  return '﻿' + [head, ...lines].map((l) => l.map(cell).join(',')).join('\r\n') + '\r\n'
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'datos'
const today = () => new Date().toISOString().slice(0, 10)

function file(name: string, format: ExportFormat, csv: () => string, json: () => unknown): ExportFile {
  return format === 'csv'
    ? { filename: `serenboard-${slug(name)}-${today()}.csv`, mime: 'text/csv; charset=utf-8', content: csv() }
    : { filename: `serenboard-${slug(name)}-${today()}.json`, mime: 'application/json; charset=utf-8', content: JSON.stringify(json(), null, 2) }
}

/** Exporta un equipo. Solo la gestión (admin o product owner), y según el plan del equipo. */
export async function exportTeam(db: Db, userId: string, teamId: string, format: ExportFormat): Promise<ExportFile> {
  const role = await requireRole(db, userId, teamId)
  if (!can(userId, role, 'team:export')) throw new ServiceError('FORBIDDEN', 'Solo la gestión del equipo puede exportar sus datos.')
  await assertCanExport(db, await teamLimits(db, teamId), format, true)

  const [team] = await db.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.id, teamId))
  const rows = await loadTasks(db, eq(tasks.team_id, teamId))
  if (format === 'csv') return file(team.name, 'csv', () => toCsv(rows, false), () => null)

  // Copia completa: además de las tareas, las personas, las etiquetas, los comentarios y qué archivos hay (no su contenido).
  const members = await db
    .select({ name: user.name, email: user.email, role: teamMembers.role, joined_at: teamMembers.joined_at })
    .from(teamMembers).innerJoin(user, eq(user.id, teamMembers.user_id)).where(eq(teamMembers.team_id, teamId)).orderBy(asc(teamMembers.joined_at))
  const tagList = await db.select({ name: tags.name, color: tags.color, parent_id: tags.parent_id, id: tags.id }).from(tags).where(eq(tags.team_id, teamId))
  const commentRows = await db
    .select({ task_id: comments.task_id, id: comments.id, parent_id: comments.parent_id, author: user.name, content: comments.content, created_at: comments.created_at })
    .from(comments).innerJoin(tasks, eq(tasks.id, comments.task_id)).innerJoin(user, eq(user.id, comments.user_id))
    .where(eq(tasks.team_id, teamId)).orderBy(asc(comments.created_at))
  const fileRows = await db
    .select({ task_id: attachments.task_id, file_name: attachments.file_name, file_type: attachments.file_type, size: attachments.size })
    .from(attachments).innerJoin(tasks, eq(tasks.id, attachments.task_id)).where(eq(tasks.team_id, teamId))

  const by = <T extends { task_id: string | null }>(list: T[]) => {
    const m = new Map<string, Omit<T, 'task_id'>[]>()
    for (const { task_id, ...rest } of list) if (task_id) m.set(task_id, [...(m.get(task_id) ?? []), rest])
    return m
  }
  const commentsBy = by(commentRows)
  const filesBy = by(fileRows)
  return file(team.name, 'json', () => '', () => ({
    exported_at: new Date().toISOString(),
    team,
    members,
    tags: tagList,
    tasks: rows.map((t) => ({ ...t, comments: commentsBy.get(t.id) ?? [], attachments: filesBy.get(t.id) ?? [] })),
  }))
}

/** Exporta las tareas de la persona (asignadas a ella o creadas por ella) en todos sus equipos. */
export async function exportMine(db: Db, userId: string, format: ExportFormat): Promise<ExportFile> {
  await assertCanExport(db, await userLimits(db, userId), format, false)
  const mine = db.select({ id: teamMembers.team_id }).from(teamMembers).where(eq(teamMembers.user_id, userId))
  const rows = await loadTasks(db, and(inArray(tasks.team_id, mine), or(eq(tasks.assigned_to, userId), eq(tasks.user_id, userId))))
  return file('mis-tareas', format, () => toCsv(rows, true), () => ({ exported_at: new Date().toISOString(), tasks: rows }))
}
